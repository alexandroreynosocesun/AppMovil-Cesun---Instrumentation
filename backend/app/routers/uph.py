"""
Router UPH/Andon - Sistema de producción Hisense
- Recibe eventos OCR de PCs de empaque
- Calcula UPH en ventana móvil de 1 hora
- Semáforo: Verde ≥90%, Naranja ≥70%, Rojo <70%
- Ranking semanal de operadores
- Gestión de operadores, modelos y asignaciones
"""

import csv
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from ..database_uph import get_uph_db
from ..models.uph_models import Operador, Linea, ModeloUPH, Turno, Asignacion, EventoUPH
from ..auth import get_current_user
from ..models.models import Tecnico

# Directorio donde se guardan los CSV en el servidor
UPH_CSV_DIR = Path(__file__).parent.parent.parent / "uph_logs"
UPH_CSV_DIR.mkdir(exist_ok=True)


def _append_csv(linea: str, estacion: str, evento: str, contador, ts: datetime):
    fecha = ts.strftime("%Y%m%d")
    archivo = UPH_CSV_DIR / f"uph_backup_{fecha}.csv"
    escribir_header = not archivo.exists()
    with open(archivo, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if escribir_header:
            writer.writerow(["timestamp", "linea", "estacion", "evento", "contador"])
        writer.writerow([ts.isoformat(), linea, estacion, evento, contador])

# ─────────────────────────────────────────────
# WebSocket — broadcast en tiempo real
# ─────────────────────────────────────────────

class _ConnectionManager:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket):
        self._clients.remove(ws)

    async def broadcast(self, msg: str):
        dead = []
        for ws in self._clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._clients.remove(ws)

ws_manager = _ConnectionManager()

router = APIRouter()

# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

class EventoIn(BaseModel):
    linea: str
    estacion: str
    evento: str
    contador: Optional[int] = None
    timestamp: Optional[str] = None  # ISO 8601


class AsignacionIn(BaseModel):
    num_empleado: str
    estacion: str
    linea_id: int
    fecha: str          # "YYYY-MM-DD"
    turno_id: int
    modelo_id: Optional[int] = None


class OperadorIn(BaseModel):
    num_empleado: str
    nombre: str
    foto_url: Optional[str] = None
    activo: bool = True


class ModeloUPHIn(BaseModel):
    nombre: str
    modelo_interno: Optional[str] = None
    tipo: Optional[str] = None
    uph_hi1: Optional[float] = None
    uph_hi2: Optional[float] = None
    uph_hi3: Optional[float] = None
    uph_hi4: Optional[float] = None
    uph_hi5: Optional[float] = None
    uph_hi6: Optional[float] = None
    uph_hi7: Optional[float] = None


class AsignacionItemIn(BaseModel):
    estacion: str
    num_empleado: str


class AsignacionBulkIn(BaseModel):
    linea: str
    fecha: str                       # "YYYY-MM-DD"
    turno_id: Optional[int] = None   # None → se detecta automáticamente
    modelo_id: Optional[int] = None
    plan_interno: Optional[int] = None   # cantidad objetivo del modelo interno
    asignaciones: List[AsignacionItemIn]


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _color_semaforo(uph_real: float, uph_meta: float) -> str:
    if uph_meta <= 0:
        return "gris"
    pct = uph_real / uph_meta
    if pct >= 0.90:
        return "verde"
    if pct >= 0.70:
        return "naranja"
    return "rojo"


def _linea_evento(linea_nombre: str) -> str:
    """
    Mapea nombre BD ('HI-6') al nombre que usan los eventos ('L6').
    Si ya es 'L6' lo devuelve igual.
    """
    import re
    m = re.search(r'\d+', linea_nombre)
    if m:
        return f"L{m.group()}"
    return linea_nombre


def _uph_hora_actual(db: Session, linea: str, estacion: Optional[str] = None) -> float:
    """Cuenta eventos GOOD desde el inicio de la hora actual en punto (XX:00)."""
    ahora = datetime.now(timezone.utc)
    inicio_hora = ahora.replace(minute=0, second=0, microsecond=0)
    q = db.query(func.count(EventoUPH.id)).filter(
        EventoUPH.linea == linea,
        EventoUPH.evento == "GOOD",
        EventoUPH.timestamp >= inicio_hora,
        EventoUPH.timestamp <= ahora,
    )
    if estacion:
        q = q.filter(EventoUPH.estacion == estacion)
    return float(q.scalar() or 0)


# Alias para compatibilidad con código existente
def _uph_ultima_hora(db: Session, linea: str, estacion: Optional[str] = None) -> float:
    return _uph_hora_actual(db, linea, estacion)


def _ensure_admin_or_jefa(current_user: Tecnico):
    if current_user.tipo_usuario not in ("admin", "superadmin", "ingeniero", "lider_linea"):
        raise HTTPException(status_code=403, detail="Sin permisos")


def _ensure_admin_only(current_user: Tecnico):
    """Solo admin/superadmin pueden gestionar operadores."""
    if current_user.tipo_usuario not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo administradores pueden gestionar operadores")


def _ensure_modelos(current_user: Tecnico):
    """Admin, superadmin e ingeniero pueden gestionar modelos UPH."""
    if current_user.tipo_usuario not in ("admin", "superadmin", "ingeniero"):
        raise HTTPException(status_code=403, detail="Sin permisos para gestionar modelos")


def seed_lineas(db):
    """Crea las líneas HI-1 a HI-6 si no existen."""
    nombres = ["HI-1", "HI-2", "HI-3", "HI-4", "HI-5", "HI-6"]
    for nombre in nombres:
        if not db.query(Linea).filter(Linea.nombre == nombre).first():
            db.add(Linea(nombre=nombre))
    db.commit()


def _ensure_gerencia(current_user: Tecnico):
    """Permite acceso a gerencia, admin, ingeniero y lider_linea."""
    if current_user.tipo_usuario not in ("admin", "superadmin", "ingeniero", "lider_linea", "gerencia"):
        raise HTTPException(status_code=403, detail="Sin permisos")


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.post("/evento", status_code=201)
def recibir_evento(evento: EventoIn, request: Request, db: Session = Depends(get_uph_db)):
    """
    Recibe eventos del cliente OCR.
    Sin autenticación (solo red local).
    """
    if evento.evento != "GOOD":
        return {"ok": False, "detalle": "Evento ignorado (solo se registran GOOD)"}

    # Siempre usar la hora del servidor para evitar desfase por zona horaria de las PCs
    ts = datetime.now(timezone.utc)

    registro = EventoUPH(
        linea=evento.linea,
        estacion=evento.estacion,
        evento=evento.evento,
        contador=evento.contador,
        timestamp=ts,
    )
    db.add(registro)
    db.commit()

    # Guardar también en CSV en el servidor
    _append_csv(evento.linea, evento.estacion, evento.evento, evento.contador, ts)

    return {"ok": True, "id": registro.id}


@router.get("/andon/{linea}")
def andon_linea(linea: str, db: Session = Depends(get_uph_db)):
    """
    Datos en tiempo real para el andon de una línea.
    Devuelve UPH por estación y el color del semáforo.
    """
    # Asignaciones activas hoy en esa línea
    hoy = datetime.now().strftime("%Y-%m-%d")
    asignaciones = (
        db.query(Asignacion)
        .join(Linea, Asignacion.linea_id == Linea.id)
        .filter(Linea.nombre == linea, Asignacion.fecha == hoy)
        .all()
    )

    # Obtener modelo de hoy (tomamos el primer modelo asignado)
    modelo = None
    if asignaciones and asignaciones[0].modelo:
        modelo = asignaciones[0].modelo

    # UPH meta: usar el campo específico de la línea (uph_hi1..uph_hi7)
    def _uph_meta_linea(modelo, linea_nombre):
        if not modelo:
            return 0
        num = ''.join(filter(str.isdigit, linea_nombre))
        attr = f"uph_hi{num}" if num else None
        val = getattr(modelo, attr, None) if attr else None
        return val if val else (modelo.uph_total or 0)

    uph_meta_total = _uph_meta_linea(modelo, linea)

    estaciones_activas = len(set(a.estacion for a in asignaciones))
    uph_meta_estacion = (uph_meta_total / estaciones_activas) if (modelo and estaciones_activas > 0) else 0

    estaciones = []
    for asig in asignaciones:
        uph_real = _uph_ultima_hora(db, linea, asig.estacion)
        color = _color_semaforo(uph_real, uph_meta_estacion)
        estaciones.append({
            "estacion": asig.estacion,
            "num_empleado": asig.num_empleado,
            "nombre_operador": asig.operador.nombre if asig.operador else None,
            "uph_real": round(uph_real, 1),
            "uph_meta": round(uph_meta_estacion, 1),
            "color": color,
        })

    uph_linea = _uph_ultima_hora(db, linea)
    uph_meta_linea = uph_meta_total

    return {
        "linea": linea,
        "modelo": modelo.nombre if modelo else None,
        "uph_linea": round(uph_linea, 1),
        "uph_meta_linea": round(uph_meta_linea, 1),
        "color_linea": _color_semaforo(uph_linea, uph_meta_linea),
        "estaciones": estaciones,
        "actualizado": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ranking/semanal")
def ranking_semanal(db: Session = Depends(get_uph_db)):
    """
    Top operadores por UPH promedio de los últimos 7 días.
    """
    hace_7_dias = datetime.now(timezone.utc) - timedelta(days=7)

    resultados = (
        db.query(
            EventoUPH.estacion,
            func.count(EventoUPH.id).label("total_eventos"),
        )
        .filter(
            EventoUPH.evento == "GOOD",
            EventoUPH.timestamp >= hace_7_dias,
        )
        .group_by(EventoUPH.estacion)
        .all()
    )

    # Buscar operador asignado a cada estación esta semana
    hoy = datetime.now().strftime("%Y-%m-%d")
    ranking = []
    for row in resultados:
        asig = (
            db.query(Asignacion)
            .filter(Asignacion.estacion == row.estacion, Asignacion.fecha <= hoy)
            .order_by(Asignacion.fecha.desc())
            .first()
        )
        operador = asig.operador if asig else None
        turno_nombre = asig.turno.nombre if (asig and asig.turno) else None
        # UPH promedio = total eventos / 7 días / horas por turno (12h)
        uph_promedio = round(row.total_eventos / 7 / 12, 2)
        ranking.append({
            "estacion": row.estacion,
            "num_empleado": operador.num_empleado if operador else None,
            "nombre": operador.nombre if operador else "Sin asignar",
            "foto_url": operador.foto_url if operador else None,
            "turno": turno_nombre,
            "uph_promedio": uph_promedio,
            "total_eventos": row.total_eventos,
        })

    ranking.sort(key=lambda x: x["uph_promedio"], reverse=True)
    return {"ranking": ranking, "periodo_dias": 7}


@router.post("/asignacion", status_code=201)
def crear_asignacion(
    data: AsignacionIn,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Asigna un operador a una estación/turno del día."""
    _ensure_admin_or_jefa(current_user)

    # Verificar que el operador existe
    op = db.query(Operador).filter(Operador.num_empleado == data.num_empleado).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operador no encontrado")

    asig = Asignacion(**data.model_dump())
    db.add(asig)
    db.commit()
    db.refresh(asig)
    return {"id": asig.id, "ok": True}


@router.get("/operadores")
def listar_operadores(
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    operadores = db.query(Operador).filter(Operador.activo == True).order_by(Operador.turno, Operador.nombre).all()
    return [
        {
            "num_empleado": o.num_empleado,
            "nombre": o.nombre,
            "foto_url": o.foto_url,
            "turno": o.turno,
            "activo": o.activo,
        }
        for o in operadores
    ]


@router.post("/operadores", status_code=201)
def crear_operador(
    data: OperadorIn,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    _ensure_admin_only(current_user)
    existente = db.query(Operador).filter(Operador.num_empleado == data.num_empleado).first()
    if existente:
        # Actualizar si ya existe
        for k, v in data.model_dump().items():
            setattr(existente, k, v)
        db.commit()
        return {"num_empleado": existente.num_empleado, "ok": True, "actualizado": True}

    op = Operador(**data.model_dump())
    db.add(op)
    db.commit()
    return {"num_empleado": op.num_empleado, "ok": True, "actualizado": False}


def _modelo_to_dict(m):
    return {
        "id": m.id,
        "nombre": m.nombre,
        "modelo_interno": m.modelo_interno,
        "tipo": m.tipo,
        "uph_hi1": m.uph_hi1,
        "uph_hi2": m.uph_hi2,
        "uph_hi3": m.uph_hi3,
        "uph_hi4": m.uph_hi4,
        "uph_hi5": m.uph_hi5,
        "uph_hi6": m.uph_hi6,
        "uph_hi7": m.uph_hi7,
        # compatibilidad: uph_total = promedio de los que tengan valor
        "uph_total": m.uph_total,
    }


@router.get("/modelos")
def listar_modelos(
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    modelos = db.query(ModeloUPH).order_by(ModeloUPH.nombre).all()
    return [_modelo_to_dict(m) for m in modelos]


@router.post("/modelos", status_code=201)
def crear_modelo(
    data: ModeloUPHIn,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    _ensure_modelos(current_user)
    modelo = ModeloUPH(
        nombre=data.nombre,
        modelo_interno=data.modelo_interno,
        tipo=data.tipo,
        uph_hi1=data.uph_hi1,
        uph_hi2=data.uph_hi2,
        uph_hi3=data.uph_hi3,
        uph_hi4=data.uph_hi4,
        uph_hi5=data.uph_hi5,
        uph_hi6=data.uph_hi6,
        uph_hi7=data.uph_hi7,
        uph_total=data.uph_hi1,  # compatibilidad: usar HI-1 como default
    )
    db.add(modelo)
    db.commit()
    db.refresh(modelo)
    return {"id": modelo.id, "ok": True}


@router.put("/modelos/{modelo_id}")
def actualizar_modelo(
    modelo_id: int,
    data: ModeloUPHIn,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    _ensure_modelos(current_user)
    modelo = db.query(ModeloUPH).filter(ModeloUPH.id == modelo_id).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    modelo.nombre = data.nombre
    modelo.modelo_interno = data.modelo_interno
    modelo.tipo = data.tipo
    modelo.uph_hi1 = data.uph_hi1
    modelo.uph_hi2 = data.uph_hi2
    modelo.uph_hi3 = data.uph_hi3
    modelo.uph_hi4 = data.uph_hi4
    modelo.uph_hi5 = data.uph_hi5
    modelo.uph_hi6 = data.uph_hi6
    modelo.uph_hi7 = data.uph_hi7
    modelo.uph_total = data.uph_hi1
    db.commit()
    return {"id": modelo.id, "ok": True}


@router.delete("/modelos/{modelo_id}", status_code=204)
def eliminar_modelo(
    modelo_id: int,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    _ensure_modelos(current_user)
    modelo = db.query(ModeloUPH).filter(ModeloUPH.id == modelo_id).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    db.delete(modelo)
    db.commit()


@router.get("/modelos/linea/{linea_nombre}")
def modelos_por_linea(
    linea_nombre: str,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Lista modelos disponibles. Si linea_nombre es 'all', devuelve todos."""
    _ensure_gerencia(current_user)
    if linea_nombre == "all":
        modelos = db.query(ModeloUPH).order_by(ModeloUPH.nombre).all()
    else:
        linea = db.query(Linea).filter(Linea.nombre == linea_nombre).first()
        if not linea:
            modelos = db.query(ModeloUPH).order_by(ModeloUPH.nombre).all()
        else:
            modelos = db.query(ModeloUPH).order_by(ModeloUPH.nombre).all()
    return [_modelo_to_dict(m) for m in modelos]


@router.get("/lineas")
def listar_lineas(
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    lineas = db.query(Linea).all()
    return [{"id": l.id, "nombre": l.nombre} for l in lineas]


@router.get("/turnos")
def listar_turnos(
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    turnos = db.query(Turno).all()
    return [
        {
            "id": t.id,
            "nombre": t.nombre,
            "dias": t.dias,
            "hora_inicio": t.hora_inicio,
            "hora_fin": t.hora_fin,
        }
        for t in turnos
    ]


# ─────────────────────────────────────────────
# Endpoints de Gerencia / Dashboard
# ─────────────────────────────────────────────

@router.get("/resumen")
def resumen_todas_lineas(
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Resumen en tiempo real de todas las líneas para gerencia."""
    _ensure_gerencia(current_user)
    lineas = db.query(Linea).order_by(Linea.nombre).all()
    hoy = datetime.now().strftime("%Y-%m-%d")
    resultado = []
    for linea in lineas:
        asig = (
            db.query(Asignacion)
            .filter(Asignacion.linea_id == linea.id, Asignacion.fecha == hoy)
            .first()
        )
        modelo = asig.modelo if asig else None
        _num = ''.join(filter(str.isdigit, linea.nombre))
        _attr = f"uph_hi{_num}" if _num else None
        _val = getattr(modelo, _attr, None) if (modelo and _attr) else None
        uph_meta = _val if _val else (modelo.uph_total or 0) if modelo else 0
        uph_real = _uph_ultima_hora(db, linea.nombre)
        total_estaciones = (
            db.query(func.count(func.distinct(Asignacion.estacion)))
            .filter(Asignacion.linea_id == linea.id, Asignacion.fecha == hoy)
            .scalar() or 0
        )
        # Contar piezas reales en la hora actual (desde inicio de hora hasta ahora)
        ahora = datetime.now(timezone.utc)
        inicio_hora = ahora.replace(minute=0, second=0, microsecond=0)
        piezas_hora = db.query(func.count(EventoUPH.id)).filter(
            EventoUPH.linea == linea.nombre,
            EventoUPH.evento == "GOOD",
            EventoUPH.timestamp >= inicio_hora,
            EventoUPH.timestamp <= ahora,
        ).scalar() or 0

        resultado.append({
            "linea": linea.nombre,
            "linea_id": linea.id,
            "modelo": modelo.nombre if modelo else None,
            "uph_real": round(uph_real, 1),
            "uph_meta": round(uph_meta, 1),
            "piezas_hora": piezas_hora,
            "color": _color_semaforo(uph_real, uph_meta),
            "total_estaciones": total_estaciones,
            "actualizado": datetime.now(timezone.utc).isoformat(),
        })
    return {"lineas": resultado, "actualizado": datetime.now(timezone.utc).isoformat()}


@router.get("/resumen/top-operadores")
def top_operadores(
    linea: Optional[str] = None,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Top operadores por piezas en la hora actual y en el día."""
    _ensure_gerencia(current_user)
    hoy = datetime.now().strftime("%Y-%m-%d")
    ahora = datetime.now(timezone.utc)
    ahora_local = datetime.now()  # hora local del servidor
    # Solo 6:30-7:00 y 18:30-19:00 son ventanas de media hora (inicio de turno)
    es_media_hora_turno = (
        (ahora_local.hour == 6  and ahora_local.minute >= 30) or
        (ahora_local.hour == 18 and ahora_local.minute >= 30)
    )
    if es_media_hora_turno:
        inicio_hora = ahora.replace(minute=30, second=0, microsecond=0)
    else:
        inicio_hora = ahora.replace(minute=0, second=0, microsecond=0)
    inicio_dia  = datetime.strptime(hoy, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    query = db.query(Asignacion).filter(Asignacion.fecha == hoy)
    if linea:
        linea_obj = db.query(Linea).filter(Linea.nombre == linea).first()
        if linea_obj:
            query = query.filter(Asignacion.linea_id == linea_obj.id)
    asignaciones = query.all()

    # Acumular por operador
    por_op: dict = {}
    for asig in asignaciones:
        if not asig.num_empleado:
            continue
        key = asig.num_empleado
        if key not in por_op:
            op = db.query(Operador).filter(Operador.num_empleado == key).first()
            por_op[key] = {
                "num_empleado": key,
                "nombre": op.nombre if op else key,
                "foto_url": op.foto_url if op else None,
                "piezas_hora": 0,
                "piezas_dia": 0,
            }
        linea_nombre = asig.linea.nombre if asig.linea else ""
        piezas_hora = db.query(func.count(EventoUPH.id)).filter(
            EventoUPH.estacion == asig.estacion,
            EventoUPH.linea == linea_nombre,
            EventoUPH.evento == "GOOD",
            EventoUPH.timestamp >= inicio_hora,
        ).scalar() or 0
        piezas_dia = db.query(func.count(EventoUPH.id)).filter(
            EventoUPH.estacion == asig.estacion,
            EventoUPH.linea == linea_nombre,
            EventoUPH.evento == "GOOD",
            EventoUPH.timestamp >= inicio_dia,
        ).scalar() or 0
        por_op[key]["piezas_hora"] += piezas_hora
        por_op[key]["piezas_dia"]  += piezas_dia

    ops = list(por_op.values())
    top_hora = sorted(ops, key=lambda x: x["piezas_hora"], reverse=True)[:3]
    top_dia  = sorted(ops, key=lambda x: x["piezas_dia"],  reverse=True)[:3]

    return {
        "top_hora": top_hora,
        "top_dia":  top_dia,
        "hora_inicio": inicio_hora.isoformat(),
        "actualizado": ahora.isoformat(),
    }


@router.get("/historial/{num_empleado}")
def historial_operador(
    num_empleado: str,
    dias: int = 7,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Historial diario de UPH y KPI de un operador."""
    _ensure_gerencia(current_user)
    operador = db.query(Operador).filter(Operador.num_empleado == num_empleado).first()
    if not operador:
        raise HTTPException(status_code=404, detail="Operador no encontrado")

    desde_fecha = (datetime.now(timezone.utc) - timedelta(days=dias)).strftime("%Y-%m-%d")
    asignaciones = (
        db.query(Asignacion)
        .filter(Asignacion.num_empleado == num_empleado, Asignacion.fecha >= desde_fecha)
        .all()
    )

    historial_por_dia: dict = {}
    for asig in asignaciones:
        fecha = asig.fecha
        linea_nombre = asig.linea.nombre if asig.linea else ""
        inicio_dia = datetime.strptime(fecha, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        fin_dia = inicio_dia + timedelta(days=1)
        eventos = (
            db.query(func.count(EventoUPH.id))
            .filter(
                EventoUPH.estacion == asig.estacion,
                EventoUPH.linea == linea_nombre,
                EventoUPH.evento == "GOOD",
                EventoUPH.timestamp >= inicio_dia,
                EventoUPH.timestamp < fin_dia,
            )
            .scalar() or 0
        )
        if fecha not in historial_por_dia:
            historial_por_dia[fecha] = {
                "total_eventos": 0,
                "uph_meta": asig.modelo.uph_total if asig.modelo else 0,
            }
        historial_por_dia[fecha]["total_eventos"] += eventos

    historial = []
    for fecha, data in sorted(historial_por_dia.items()):
        uph_dia = round(data["total_eventos"] / 12, 2)
        uph_meta = data["uph_meta"]
        kpi_pct = round((uph_dia / uph_meta * 100) if uph_meta > 0 else 0, 1)
        historial.append({
            "fecha": fecha,
            "total_eventos": data["total_eventos"],
            "uph_promedio": uph_dia,
            "uph_meta": round(uph_meta, 1),
            "kpi_pct": kpi_pct,
        })

    return {
        "operador": {
            "num_empleado": operador.num_empleado,
            "nombre": operador.nombre,
            "foto_url": operador.foto_url,
        },
        "historial": historial,
        "periodo_dias": dias,
    }


@router.get("/reporte/semanal/completo")
def reporte_semanal_completo(
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Reporte semanal completo: todos los operadores con UPH promedio y KPI."""
    _ensure_gerencia(current_user)
    hace_7_dias = datetime.now(timezone.utc) - timedelta(days=7)
    desde_fecha = hace_7_dias.strftime("%Y-%m-%d")

    operadores = db.query(Operador).filter(Operador.activo == True).all()
    resultado = []
    for op in operadores:
        asignaciones = (
            db.query(Asignacion)
            .filter(Asignacion.num_empleado == op.num_empleado, Asignacion.fecha >= desde_fecha)
            .all()
        )
        if not asignaciones:
            continue

        estaciones = list(set(a.estacion for a in asignaciones))
        total_eventos = (
            db.query(func.count(EventoUPH.id))
            .filter(
                EventoUPH.estacion.in_(estaciones),
                EventoUPH.evento == "GOOD",
                EventoUPH.timestamp >= hace_7_dias,
            )
            .scalar() or 0
        )

        dias_activos = len(set(a.fecha for a in asignaciones))
        horas_trabajadas = dias_activos * 12
        uph_promedio = round(total_eventos / horas_trabajadas, 2) if horas_trabajadas > 0 else 0

        ultimo_modelo = next(
            (a.modelo for a in sorted(asignaciones, key=lambda x: x.fecha, reverse=True) if a.modelo),
            None,
        )
        uph_meta = ultimo_modelo.uph_total if ultimo_modelo else 0
        kpi_pct = round((uph_promedio / uph_meta * 100) if uph_meta > 0 else 0, 1)

        resultado.append({
            "num_empleado": op.num_empleado,
            "nombre": op.nombre,
            "foto_url": op.foto_url,
            "total_eventos": total_eventos,
            "uph_promedio": uph_promedio,
            "uph_meta": round(uph_meta, 1),
            "kpi_pct": kpi_pct,
            "dias_activos": dias_activos,
        })

    resultado.sort(key=lambda x: x["uph_promedio"], reverse=True)
    for i, op in enumerate(resultado):
        op["ranking"] = i + 1

    return {
        "periodo": {"desde": desde_fecha, "hasta": datetime.now().strftime("%Y-%m-%d")},
        "operadores": resultado,
        "total_operadores": len(resultado),
    }


# ─────────────────────────────────────────────
# Endpoints de Asignación / Scoreboard
# ─────────────────────────────────────────────

@router.get("/turno/actual")
def turno_actual(db: Session = Depends(get_uph_db), current_user: Tecnico = Depends(get_current_user)):
    """Detecta el turno actual con la misma lógica día-consciente del dashboard."""
    ahora_loc = datetime.now()
    wd   = ahora_loc.weekday()   # 0=Lun … 6=Dom
    mins = ahora_loc.hour * 60 + ahora_loc.minute
    T_INI, T_FIN = 6 * 60 + 30, 18 * 60 + 30   # 06:30 / 18:30

    turno_id_act = None
    if wd in (0, 1, 2, 3):      # Lun–Jue
        if T_INI <= mins < T_FIN:   turno_id_act = 1   # A diurno
        elif mins >= T_FIN:          turno_id_act = 2   # B nocturno empieza hoy
        else:                        turno_id_act = 2   # B nocturno del día anterior
    elif wd == 4:                # Viernes
        if mins < T_INI:             turno_id_act = 2   # B noche del jueves
        elif T_INI <= mins < T_FIN:  turno_id_act = 3   # C viernes día
        else:                        turno_id_act = 2   # B extra noche viernes
    elif wd == 5:                # Sábado
        if mins < T_INI:             turno_id_act = 2   # B extra noche viernes→sábado
        elif T_INI <= mins < T_FIN:  turno_id_act = 3   # C sábado día
    elif wd == 6:                # Domingo
        if T_INI <= mins < T_FIN:    turno_id_act = 3   # C domingo día

    if turno_id_act:
        t = db.query(Turno).filter(Turno.id == turno_id_act).first()
        if t:
            return {"turno": t, "detectado": True}
    return {"turno": None, "detectado": False}


@router.get("/lineas/{linea_nombre}/estaciones")
def estaciones_linea(
    linea_nombre: str,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Estaciones configuradas para una línea (de asignaciones activas o predefinidas)."""
    _ensure_gerencia(current_user)
    estaciones_pre = ESTACIONES_POR_LINEA.get(linea_nombre, [])
    if estaciones_pre:
        return {"linea": linea_nombre, "estaciones": estaciones_pre}
    # Fallback: derivar de asignaciones históricas
    rows = (
        db.query(func.distinct(Asignacion.estacion))
        .join(Linea, Asignacion.linea_id == Linea.id)
        .filter(Linea.nombre == linea_nombre)
        .all()
    )
    return {"linea": linea_nombre, "estaciones": sorted([r[0] for r in rows])}


@router.get("/asignacion/hoy")
def get_asignacion_hoy(
    linea: str,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Devuelve la asignación activa de hoy para una línea, agrupada por operador."""
    hoy = datetime.now().strftime("%Y-%m-%d")
    linea_obj = db.query(Linea).filter(Linea.nombre == linea).first()
    if not linea_obj:
        return {"operadores": [], "modelo_id": None}

    asigs = (
        db.query(Asignacion)
        .filter(Asignacion.linea_id == linea_obj.id, Asignacion.fecha == hoy)
        .all()
    )
    if not asigs:
        return {"operadores": [], "modelo_id": None}

    modelo_id    = asigs[0].modelo_id    if asigs else None
    plan_interno = asigs[0].plan_interno if asigs else None

    # Agrupar estaciones por operador
    from collections import defaultdict
    por_op = defaultdict(list)
    for a in asigs:
        if a.num_empleado:
            por_op[a.num_empleado].append(a.estacion)

    resultado = []
    for num_emp, estaciones in por_op.items():
        op = db.query(Operador).filter(Operador.num_empleado == num_emp).first()
        resultado.append({
            "num_empleado": num_emp,
            "nombre": op.nombre if op else num_emp,
            "foto_url": op.foto_url if op else None,
            "turno": op.turno if op else None,
            "estaciones": estaciones,
        })

    modelo_obj = db.query(ModeloUPH).filter(ModeloUPH.id == modelo_id).first() if modelo_id else None
    return {
        "operadores": resultado,
        "modelo_id": modelo_id,
        "modelo_nombre": modelo_obj.nombre if modelo_obj else None,
        "plan_interno": plan_interno,
    }


@router.patch("/asignacion/hoy/modelo")
def actualizar_modelo_hoy(
    linea: str,
    modelo_id: int,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Cambia solo el modelo de las asignaciones de hoy sin tocar los operadores."""
    _ensure_admin_or_jefa(current_user)
    hoy = datetime.now().strftime("%Y-%m-%d")
    linea_obj = db.query(Linea).filter(Linea.nombre == linea).first()
    if not linea_obj:
        raise HTTPException(status_code=404, detail="Línea no encontrada")
    modelo = db.query(ModeloUPH).filter(ModeloUPH.id == modelo_id).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    actualizadas = db.query(Asignacion).filter(
        Asignacion.linea_id == linea_obj.id,
        Asignacion.fecha == hoy,
    ).update({"modelo_id": modelo_id})
    db.commit()
    return {"ok": True, "actualizadas": actualizadas, "modelo": modelo.nombre}


@router.delete("/asignacion/hoy")
def limpiar_asignacion_hoy(
    linea: str,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Elimina la asignación de hoy para una línea."""
    _ensure_admin_or_jefa(current_user)
    hoy = datetime.now().strftime("%Y-%m-%d")
    linea_obj = db.query(Linea).filter(Linea.nombre == linea).first()
    if not linea_obj:
        raise HTTPException(status_code=404, detail="Línea no encontrada")
    eliminadas = db.query(Asignacion).filter(
        Asignacion.linea_id == linea_obj.id,
        Asignacion.fecha == hoy,
    ).delete()
    db.commit()
    return {"ok": True, "eliminadas": eliminadas}


@router.post("/asignacion/bulk", status_code=201)
async def crear_asignacion_bulk(
    data: AsignacionBulkIn,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Asigna múltiples operadores a estaciones de una línea para el día/turno indicado."""
    _ensure_admin_or_jefa(current_user)

    linea = db.query(Linea).filter(Linea.nombre == data.linea).first()
    if not linea:
        raise HTTPException(status_code=404, detail=f"Línea '{data.linea}' no encontrada")

    # Auto-detectar turno si no se envió
    turno_id = data.turno_id
    if not turno_id:
        ahora_loc = datetime.now()
        wd   = ahora_loc.weekday()
        mins = ahora_loc.hour * 60 + ahora_loc.minute
        T_INI, T_FIN = 6 * 60 + 30, 18 * 60 + 30
        if wd in (0, 1, 2, 3):
            turno_id = 1 if T_INI <= mins < T_FIN else 2
        elif wd == 4:
            turno_id = 2 if mins < T_INI else (3 if T_INI <= mins < T_FIN else 2)
        elif wd == 5:
            turno_id = 2 if mins < T_INI else (3 if T_INI <= mins < T_FIN else None)
        elif wd == 6:
            turno_id = 3 if T_INI <= mins < T_FIN else None
        if not turno_id:
            raise HTTPException(status_code=400, detail="Fuera de horario de producción — no se puede asignar")

    turno = db.query(Turno).filter(Turno.id == turno_id).first()
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    # Eliminar TODAS las asignaciones previas del día para esa línea
    # (sin importar turno) para evitar duplicados al re-guardar
    db.query(Asignacion).filter(
        Asignacion.linea_id == linea.id,
        Asignacion.fecha == data.fecha,
    ).delete()

    creadas = 0
    for item in data.asignaciones:
        if not item.num_empleado:
            continue
        op = db.query(Operador).filter(Operador.num_empleado == item.num_empleado).first()
        if not op:
            continue
        asig = Asignacion(
            num_empleado=item.num_empleado,
            estacion=item.estacion,
            linea_id=linea.id,
            fecha=data.fecha,
            turno_id=turno_id,
            modelo_id=data.modelo_id,
            plan_interno=data.plan_interno,
        )
        db.add(asig)
        creadas += 1

    db.commit()
    await ws_manager.broadcast("refresh")
    return {"ok": True, "creadas": creadas, "linea": data.linea, "fecha": data.fecha}


@router.get("/scoreboard/hoy")
def scoreboard_hoy(
    linea: Optional[str] = None,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Scoreboard en tiempo real del día: operadores rankeados por KPI actual."""
    _ensure_gerencia(current_user)
    hoy = datetime.now().strftime("%Y-%m-%d")
    ahora = datetime.now(timezone.utc)
    inicio_dia = datetime.strptime(hoy, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    query = db.query(Asignacion).filter(Asignacion.fecha == hoy)
    if linea:
        linea_obj = db.query(Linea).filter(Linea.nombre == linea).first()
        if linea_obj:
            query = query.filter(Asignacion.linea_id == linea_obj.id)

    asignaciones = query.all()

    # Pre-calcular # estaciones por linea para dividir UPH meta
    estaciones_por_linea: dict = {}
    for asig in asignaciones:
        lid = asig.linea_id
        if lid not in estaciones_por_linea:
            estaciones_por_linea[lid] = set()
        estaciones_por_linea[lid].add(asig.estacion)

    resultado = []
    for asig in asignaciones:
        linea_nombre = asig.linea.nombre if asig.linea else ""
        num_est = len(estaciones_por_linea.get(asig.linea_id, {1})) or 1
        # Usar UPH específico de la línea
        _num = ''.join(filter(str.isdigit, linea_nombre))
        _attr = f"uph_hi{_num}" if _num else None
        _uph_linea_val = getattr(asig.modelo, _attr, None) if (asig.modelo and _attr) else None
        uph_meta_linea = _uph_linea_val if _uph_linea_val else (asig.modelo.uph_total if asig.modelo else 0)
        uph_meta_est = round(uph_meta_linea / num_est, 1)

        uph_hora = _uph_ultima_hora(db, linea_nombre, asig.estacion)

        total_hoy = (
            db.query(func.count(EventoUPH.id))
            .filter(
                EventoUPH.estacion == asig.estacion,
                EventoUPH.linea == linea_nombre,
                EventoUPH.evento == "GOOD",
                EventoUPH.timestamp >= inicio_dia,
                EventoUPH.timestamp <= ahora,
            )
            .scalar() or 0
        )

        kpi_pct = round((uph_hora / uph_meta_est * 100) if uph_meta_est > 0 else 0, 1)

        resultado.append({
            "estacion": asig.estacion,
            "num_empleado": asig.operador.num_empleado if asig.operador else None,
            "nombre": asig.operador.nombre if asig.operador else "Sin asignar",
            "foto_url": asig.operador.foto_url if asig.operador else None,
            "linea": linea_nombre,
            "uph_hora": round(uph_hora, 1),
            "uph_meta": uph_meta_est,
            "kpi_pct": kpi_pct,
            "total_hoy": total_hoy,
            "excedente": round(uph_hora - uph_meta_est, 1),
        })

    resultado.sort(key=lambda x: x["kpi_pct"], reverse=True)
    for i, r in enumerate(resultado):
        r["ranking"] = i + 1

    return {
        "scoreboard": resultado,
        "fecha": hoy,
        "actualizado": ahora.isoformat(),
    }


# ─────────────────────────────────────────────
# Endpoints de testing / dashboard
# ─────────────────────────────────────────────

ESTACIONES_POR_LINEA = {
    # Líneas HI (producción principal)
    "HI-1": [str(i) for i in range(101, 105)],   # 101-104
    "HI-2": [str(i) for i in range(201, 208)],   # 201-207
    "HI-3": [str(i) for i in range(301, 307)],   # 301-306
    "HI-4": [str(i) for i in range(401, 409)],   # 401-408
    "HI-5": [str(i) for i in range(501, 509)],   # 501-508
    "HI-6": [str(i) for i in range(601, 609)],   # 601-608
    # Líneas legacy
    "L6":  [str(i) for i in range(601, 609)],
    "L7":  [str(i) for i in range(701, 709)],
    "L8":  [str(i) for i in range(801, 809)],
    "L9":  [str(i) for i in range(901, 909)],
    "L10": [str(i) for i in range(1001, 1009)],
    "L11": [str(i) for i in range(1101, 1109)],
}


@router.get("/datos")
def api_datos(linea: str = "L6", db: Session = Depends(get_uph_db)):
    """
    Modo prueba: acumula TODOS los eventos GOOD desde el inicio (sin ventana de 1h).
    Equivalente al /api/datos del servidor Flask original.
    """
    ahora = datetime.now(timezone.utc)
    desde = datetime(2000, 1, 1, tzinfo=timezone.utc)

    rows = (
        db.query(EventoUPH.estacion, func.count(EventoUPH.id).label("total"))
        .filter(
            EventoUPH.linea == linea,
            EventoUPH.evento == "GOOD",
            EventoUPH.timestamp >= desde,
        )
        .group_by(EventoUPH.estacion)
        .all()
    )
    conteos = {r.estacion: r.total for r in rows}

    estaciones_list = ESTACIONES_POR_LINEA.get(linea, [str(i) for i in range(601, 609)])
    datos = [
        {
            "estacion": est,
            "hora_actual": conteos.get(est, 0),
            "turno": conteos.get(est, 0),
            "uph": _uph_ultima_hora(db, linea, est),
        }
        for est in estaciones_list
    ]
    return {"linea": linea, "hora": ahora.strftime("%H:%M:%S"), "estaciones": datos}


@router.get("/estado_cliente")
def estado_cliente(linea: str = "L6", db: Session = Depends(get_uph_db)):
    """Indica si el cliente OCR está activo (último evento < 3 min)."""
    ultimo = (
        db.query(func.max(EventoUPH.timestamp))
        .filter(EventoUPH.linea == linea)
        .scalar()
    )
    if ultimo is None:
        return {"conectado": False, "hace": "nunca"}

    if ultimo.tzinfo is None:
        ultimo = ultimo.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - ultimo
    minutos = int(delta.total_seconds() / 60)
    if minutos < 1:
        hace = "hace menos de 1 min"
    elif minutos == 1:
        hace = "hace 1 min"
    else:
        hace = f"hace {minutos} min"
    return {"conectado": delta.total_seconds() < 180, "hace": hace}


class LimpiarIn(BaseModel):
    linea: Optional[str] = None


@router.post("/limpiar")
def limpiar_eventos(data: LimpiarIn, db: Session = Depends(get_uph_db)):
    """Elimina eventos para pruebas. Si linea=None borra todo."""
    q = db.query(EventoUPH)
    if data.linea:
        q = q.filter(EventoUPH.linea == data.linea)
    eliminados = q.delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "eliminados": eliminados}


@router.get("/dashboard/operadores", response_class=HTMLResponse)
def dashboard_operadores():
    """Dashboard de pared — muestra operadores asignados hoy con fotos."""
    html_path = Path(__file__).parent.parent.parent / "dashboard_operadores.html"
    if not html_path.exists():
        return HTMLResponse("<h1>dashboard_operadores.html no encontrado</h1>", status_code=404)
    return HTMLResponse(html_path.read_text(encoding="utf-8"))




@router.get("/dashboard/asignaciones-hoy")
def asignaciones_hoy_publico(db: Session = Depends(get_uph_db)):
    """
    Operadores asignados hoy, agrupados por línea — sin autenticación.
    Usado por el dashboard de pared.
    """
    hoy = datetime.now().strftime("%Y-%m-%d")
    asigs = (
        db.query(Asignacion)
        .filter(Asignacion.fecha == hoy)
        .all()
    )
    # Agrupar por línea y operador único
    from collections import defaultdict
    por_linea = defaultdict(dict)
    for a in asigs:
        linea = db.query(Linea).filter(Linea.id == a.linea_id).first()
        linea_nombre = linea.nombre if linea else f"L{a.linea_id}"
        if a.num_empleado not in por_linea[linea_nombre]:
            op = db.query(Operador).filter(Operador.num_empleado == a.num_empleado).first()
            por_linea[linea_nombre][a.num_empleado] = {
                "num_empleado": a.num_empleado,
                "nombre": op.nombre if op else a.num_empleado,
                "foto_url": op.foto_url if op else None,
                "turno": op.turno if op else None,
            }
    resultado = [
        {
            "linea": linea,
            "operadores": list(ops.values()),
        }
        for linea, ops in sorted(por_linea.items())
    ]
    return {
        "fecha": hoy,
        "lineas": resultado,
        "actualizado": datetime.now(timezone.utc).isoformat(),
    }


@router.websocket("/ws")
async def uph_websocket(ws: WebSocket):
    """Dashboard se conecta aquí y recibe 'refresh' cada vez que llega un evento nuevo."""
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()   # mantiene viva la conexión (ping del cliente)
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


@router.post("/internal/notify", include_in_schema=False)
async def internal_notify():
    """run_uph.py (puerto 5000) llama esto después de guardar un EventoUPH."""
    await ws_manager.broadcast("refresh")
    return {"ok": True, "clients": len(ws_manager._clients)}


@router.get("/dashboard/lineas-hoy")
def dashboard_lineas_hoy(db: Session = Depends(get_uph_db)):
    """
    Datos completos para wall dashboard v2 — sin autenticación.
    Retorna por línea: UPH actual, meta, modelo, piezas acumuladas del modelo,
    y por cada operador asignado: sus estaciones con UPH hora y meta.
    """
    ahora     = datetime.now(timezone.utc)
    ahora_loc = datetime.now()   # naive, hora local del servidor

    # Offset UTC del servidor
    utc_offset = ahora.replace(tzinfo=None) - ahora_loc

    def _local_to_utc(naive_local: datetime) -> datetime:
        return (naive_local + utc_offset).replace(tzinfo=timezone.utc)

    # ── Turno activo ─────────────────────────────────────────────
    # ── Turnos ───────────────────────────────────────────────────
    # A (id=1): Lun–Jue  06:30–18:30
    # B (id=2): Lun–Jue  18:30–06:30 (cruza medianoche, termina Vie 06:30)
    # C (id=3): Vie–Dom  06:30–18:30 (cada día por separado)
    # Sin turno: Vie–Dom 18:30–06:30
    #
    # weekday(): 0=Lun 1=Mar 2=Mié 3=Jue 4=Vie 5=Sáb 6=Dom
    wd    = ahora_loc.weekday()
    mins  = ahora_loc.hour * 60 + ahora_loc.minute
    T_INI = 6 * 60 + 30    # 06:30
    T_FIN = 18 * 60 + 30   # 18:30

    turno_id_act     = None
    fecha_asig       = ahora_loc.strftime("%Y-%m-%d")
    inicio_turno_utc = ahora.replace(minute=0, second=0, microsecond=0)

    if wd in (0, 1, 2, 3):      # Lunes–Jueves
        if T_INI <= mins < T_FIN:
            # Turno A diurno
            turno_id_act     = 1
            inicio_turno_utc = _local_to_utc(ahora_loc.replace(hour=6, minute=30, second=0, microsecond=0))
        elif mins >= T_FIN:
            # Turno B nocturno (empieza hoy)
            turno_id_act     = 2
            inicio_turno_utc = _local_to_utc(ahora_loc.replace(hour=18, minute=30, second=0, microsecond=0))
        else:
            # 00:00–06:29 → continuación Turno B del día anterior
            turno_id_act     = 2
            ayer             = ahora_loc - timedelta(days=1)
            fecha_asig       = ayer.strftime("%Y-%m-%d")
            inicio_turno_utc = _local_to_utc(ayer.replace(hour=18, minute=30, second=0, microsecond=0))

    elif wd == 4:                # Viernes
        if mins < T_INI:
            # 00:00–06:29 → Turno B nocturno del jueves
            turno_id_act     = 2
            ayer             = ahora_loc - timedelta(days=1)
            fecha_asig       = ayer.strftime("%Y-%m-%d")
            inicio_turno_utc = _local_to_utc(ayer.replace(hour=18, minute=30, second=0, microsecond=0))
        elif T_INI <= mins < T_FIN:
            # Viernes 06:30–18:29 → Turno C
            turno_id_act     = 3
            inicio_turno_utc = _local_to_utc(ahora_loc.replace(hour=6, minute=30, second=0, microsecond=0))
        else:
            # Viernes 18:30+ → Turno B extra (noche viernes)
            turno_id_act     = 2
            inicio_turno_utc = _local_to_utc(ahora_loc.replace(hour=18, minute=30, second=0, microsecond=0))

    elif wd == 5:                # Sábado
        if mins < T_INI:
            # 00:00–06:29 → Turno B extra (empezó viernes 18:30)
            turno_id_act     = 2
            ayer             = ahora_loc - timedelta(days=1)
            fecha_asig       = ayer.strftime("%Y-%m-%d")
            inicio_turno_utc = _local_to_utc(ayer.replace(hour=18, minute=30, second=0, microsecond=0))
        elif T_INI <= mins < T_FIN:
            # Sábado 06:30–18:29 → Turno C
            turno_id_act     = 3
            inicio_turno_utc = _local_to_utc(ahora_loc.replace(hour=6, minute=30, second=0, microsecond=0))
        # else: Sábado 18:30+ → sin turno

    elif wd == 6:                # Domingo
        if T_INI <= mins < T_FIN:
            # Domingo 06:30–18:29 → Turno C
            turno_id_act     = 3
            inicio_turno_utc = _local_to_utc(ahora_loc.replace(hour=6, minute=30, second=0, microsecond=0))
        # else: Domingo noche → sin turno

    inicio_hora = ahora.replace(minute=0, second=0, microsecond=0)
    hoy         = ahora_loc.strftime("%Y-%m-%d")

    # Sin turno activo → dashboard vacío
    if turno_id_act is None:
        return {
            "lineas": [],
            "turno_activo": None,
            "fuera_horario": True,
            "actualizado": ahora.isoformat(),
        }

    lineas = db.query(Linea).order_by(Linea.nombre).all()

    resultado = []
    for linea in lineas:
        # Asignaciones del turno activo para esta línea
        # Primero buscar por turno activo exacto; si no hay, usar cualquier asignación del día
        asignaciones = (
            db.query(Asignacion)
            .filter(
                Asignacion.linea_id == linea.id,
                Asignacion.fecha    == fecha_asig,
                Asignacion.turno_id == turno_id_act,
            )
            .all()
        )
        if not asignaciones:
            asignaciones = (
                db.query(Asignacion)
                .filter(
                    Asignacion.linea_id == linea.id,
                    Asignacion.fecha    == fecha_asig,
                )
                .all()
            )

        # Modelo actual desde primera asignación
        modelo = asignaciones[0].modelo if asignaciones else None
        modelo_nombre = modelo.nombre if modelo else None

        # Nombre de línea tal como llega en los eventos (L6, L1, etc.)
        nombre_evento = _linea_evento(linea.nombre)

        # UPH meta específica de la línea
        _num = ''.join(filter(str.isdigit, linea.nombre))
        _attr = f"uph_hi{_num}" if _num else None
        _val = getattr(modelo, _attr, None) if (modelo and _attr) else None
        uph_meta = _val if _val else (modelo.uph_total if modelo else 0) if modelo else 0

        # UPH actual: piezas desde inicio de la hora en punto (XX:00)
        uph_actual = db.query(func.count(EventoUPH.id)).filter(
            EventoUPH.linea == nombre_evento,
            EventoUPH.evento == "GOOD",
            EventoUPH.timestamp >= inicio_hora,
            EventoUPH.timestamp <= ahora,
        ).scalar() or 0

        # Piezas acumuladas desde inicio del turno activo
        piezas_modelo = db.query(func.count(EventoUPH.id)).filter(
            EventoUPH.linea == nombre_evento,
            EventoUPH.evento == "GOOD",
            EventoUPH.timestamp >= inicio_turno_utc,
            EventoUPH.timestamp <= ahora,
        ).scalar() or 0

        # Plan del modelo: usa plan_interno si la líder lo configuró, sino meta × 12h turno
        plan_interno = asignaciones[0].plan_interno if asignaciones else None
        plan_modelo  = plan_interno if plan_interno else round(uph_meta * 12)

        # Número de estaciones únicas en esta línea hoy
        estaciones_unicas = list({a.estacion for a in asignaciones})
        num_est = len(estaciones_unicas) or 1
        uph_meta_est = round(uph_meta / num_est, 1)

        # Agrupar por operador y calcular UPH por estación
        ops_dict: dict = {}
        for a in asignaciones:
            emp = a.num_empleado
            if emp not in ops_dict:
                op = a.operador
                ops_dict[emp] = {
                    "num_empleado": emp,
                    "nombre": op.nombre if op else str(emp),
                    "foto_url": op.foto_url if op else None,
                    "estaciones": [],
                }
            uph_hora_est = _uph_hora_actual(db, nombre_evento, a.estacion)
            kpi_pct = round((uph_hora_est / uph_meta_est * 100) if uph_meta_est > 0 else 0, 1)
            ops_dict[emp]["estaciones"].append({
                "estacion": a.estacion,
                "uph_hora": round(uph_hora_est, 1),
                "uph_meta": uph_meta_est,
                "kpi_pct": kpi_pct,
            })

        resultado.append({
            "linea": linea.nombre,
            "modelo": modelo_nombre,
            "uph_actual": uph_actual,
            "uph_meta": uph_meta,
            "piezas_modelo": piezas_modelo,
            "plan_modelo": plan_modelo,
            "operadores": list(ops_dict.values()),
        })

    return {
        "lineas": resultado,
        "turno_activo": turno_id_act,
        "actualizado": ahora.isoformat(),
    }


@router.get("/tendencias")
def tendencias_uph(desde: Optional[str] = None, horas: int = 12, db: Session = Depends(get_uph_db)):
    """
    UPH por hora para cada línea desde el inicio del turno activo.
    Acepta `desde` (ISO 8601) o `horas` como fallback.
    """
    ahora  = datetime.now(timezone.utc)

    if desde:
        try:
            inicio_turno = datetime.fromisoformat(desde.replace('Z', '+00:00'))
            if inicio_turno.tzinfo is None:
                inicio_turno = inicio_turno.replace(tzinfo=timezone.utc)
        except Exception:
            inicio_turno = ahora - timedelta(hours=horas)
    else:
        inicio_turno = ahora - timedelta(hours=horas)

    # Generar slots hora a hora desde inicio_turno hasta ahora
    # El primer slot empieza exactamente en inicio_turno (ej. 06:30)
    # Los siguientes en hora en punto
    slots = []
    cur = inicio_turno
    while cur <= ahora:
        slots.append(cur)
        # Siguiente slot: siguiente hora en punto
        next_slot = (cur + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        if next_slot == cur:  # ya era hora en punto
            next_slot = cur + timedelta(hours=1)
        cur = next_slot

    lineas    = db.query(Linea).order_by(Linea.nombre).all()
    resultado = []

    from datetime import datetime as _dt
    hoy = _dt.now().strftime("%Y-%m-%d")

    for linea in lineas:
        nombre_evento = _linea_evento(linea.nombre)

        # Meta de la línea: buscar modelo activo de hoy
        asig = db.query(Asignacion).filter(
            Asignacion.linea_id == linea.id,
            Asignacion.fecha    == hoy,
        ).first()
        modelo  = asig.modelo if asig else None
        _num    = ''.join(filter(str.isdigit, linea.nombre))
        _attr   = f"uph_hi{_num}" if _num else None
        _val    = getattr(modelo, _attr, None) if (modelo and _attr) else None
        uph_meta = _val if _val else (modelo.uph_total if modelo else 100) if modelo else 100

        puntos = []
        for idx, slot in enumerate(slots):
            # fin del slot: siguiente slot o ahora (el último slot está incompleto)
            if idx + 1 < len(slots):
                fin = slots[idx + 1]
            else:
                fin = ahora

            minutos = max(1, (fin - slot).total_seconds() / 60)
            conteo  = db.query(func.count(EventoUPH.id)).filter(
                EventoUPH.linea  == nombre_evento,
                EventoUPH.evento == "GOOD",
                EventoUPH.timestamp >= slot,
                EventoUPH.timestamp <  fin,
            ).scalar() or 0

            # meta proporcional al slot (ej. 30 min → meta/2)
            meta_slot = round(uph_meta * minutos / 60)

            puntos.append({
                "hora":      slot.strftime("%H:%M"),
                "uph":       conteo,        # piezas reales producidas en el slot
                "meta_slot": meta_slot,     # meta proporcional (no normalizada)
                "minutos":   round(minutos),
            })

        resultado.append({
            "linea":    linea.nombre,
            "uph_meta": uph_meta,
            "puntos":   puntos,
        })

    return {
        "lineas":      resultado,
        "horas":       horas,
        "actualizado": ahora.isoformat(),
    }


@router.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    """Dashboard HTML de testing — sin autenticación."""
    html = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UPH Dashboard - Hisense</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f0f0f; color: #eee; min-height: 100vh; }
  header { background: #1a1a2e; padding: 16px 24px; display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #2196F3; }
  header h1 { font-size: 1.4rem; color: #2196F3; }
  .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 14px 24px; background: #111; border-bottom: 1px solid #222; }
  select, button { padding: 8px 14px; border-radius: 6px; border: 1px solid #333; background: #1e1e1e; color: #eee; font-size: 14px; cursor: pointer; }
  button:hover { background: #2a2a2a; }
  .btn-limpiar { background: #7f1d1d; border-color: #ef4444; color: #fca5a5; }
  .btn-limpiar:hover { background: #991b1b; }
  #estado { font-size: 13px; color: #888; margin-left: auto; }
  #estado .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .dot.verde { background: #22c55e; }
  .dot.rojo  { background: #ef4444; }
  main { padding: 20px 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 18px; text-align: center; transition: border-color .3s; }
  .card.verde  { border-color: #22c55e; }
  .card.naranja{ border-color: #f97316; }
  .card.rojo   { border-color: #ef4444; }
  .estacion-label { font-size: 12px; color: #888; margin-bottom: 4px; }
  .estacion-num { font-size: 1.8rem; font-weight: bold; color: #2196F3; }
  .contador { font-size: 2.4rem; font-weight: bold; margin: 10px 0; }
  .card.verde  .contador { color: #22c55e; }
  .card.naranja .contador { color: #f97316; }
  .card.rojo   .contador { color: #ef4444; }
  .uph-label { font-size: 12px; color: #666; }
  .uph-val { font-size: 1.1rem; color: #aaa; }
  .meta-line { font-size: 12px; color: #555; margin-top: 6px; }
  .hora { text-align: right; color: #555; font-size: 13px; padding: 8px 0; }
  .semaforo { display: inline-block; width: 14px; height: 14px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
  .semaforo.verde   { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
  .semaforo.naranja { background: #f97316; box-shadow: 0 0 8px #f97316; }
  .semaforo.rojo    { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
</style>
</head>
<body>
<header>
  <h1>⚡ UPH Dashboard — Hisense</h1>
  <span style="color:#555;font-size:13px">Testing / Producción</span>
</header>
<div class="controls">
  <label for="linea" style="color:#aaa;font-size:14px">Línea:</label>
  <select id="linea" onchange="cargar()">
    <option>L6</option><option>L7</option><option>L8</option>
    <option>L9</option><option>L10</option><option>L11</option>
  </select>
  <button onclick="cargar()">🔄 Actualizar</button>
  <button class="btn-limpiar" onclick="limpiar()">🗑️ Limpiar datos</button>
  <div id="estado"><span class="dot rojo" id="dot"></span><span id="estado-txt">Verificando...</span></div>
</div>
<main>
  <div class="hora" id="hora">—</div>
  <div class="grid" id="grid">Cargando...</div>
</main>
<script>
const BASE = window.location.origin;

function colorCard(uph, meta) {
  if (!meta || meta <= 0) return '';
  const pct = uph / meta;
  if (pct >= 0.9) return 'verde';
  if (pct >= 0.7) return 'naranja';
  return 'rojo';
}

async function cargar() {
  const linea = document.getElementById('linea').value;

  // Datos acumulados (modo prueba)
  const r = await fetch(`${BASE}/api/uph/datos?linea=${linea}`);
  const d = await r.json();
  document.getElementById('hora').textContent = 'Actualizado: ' + d.hora;

  // Datos andon (UPH real + meta + color)
  let andon = null;
  try {
    const ra = await fetch(`${BASE}/api/uph/andon/${linea}`, {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
    });
    if (ra.ok) andon = await ra.json();
  } catch(e) {}

  const andonMap = {};
  if (andon && andon.estaciones) {
    andon.estaciones.forEach(e => { andonMap[e.estacion] = e; });
  }

  const grid = document.getElementById('grid');
  grid.innerHTML = d.estaciones.map(est => {
    const a = andonMap[est.estacion] || {};
    const uph = a.uph_real ?? est.uph;
    const meta = a.uph_meta ?? 0;
    const color = a.color || colorCard(uph, meta);
    return `<div class="card ${color}">
      <div class="estacion-label">Estación</div>
      <div class="estacion-num">${est.estacion}</div>
      <div class="contador">${est.hora_actual}</div>
      <div class="uph-label">UPH última hora</div>
      <div class="uph-val"><span class="semaforo ${color}"></span>${uph.toFixed ? uph.toFixed(1) : uph}</div>
      ${meta > 0 ? `<div class="meta-line">Meta: ${meta.toFixed ? meta.toFixed(1) : meta}</div>` : ''}
      ${a.nombre_operador ? `<div class="meta-line" style="color:#888;margin-top:8px">👤 ${a.nombre_operador}</div>` : ''}
    </div>`;
  }).join('');

  // Estado cliente OCR
  const re = await fetch(`${BASE}/api/uph/estado_cliente?linea=${linea}`);
  const estado = await re.json();
  document.getElementById('dot').className = 'dot ' + (estado.conectado ? 'verde' : 'rojo');
  document.getElementById('estado-txt').textContent = `OCR cliente: ${estado.hace}`;
}

async function limpiar() {
  const linea = document.getElementById('linea').value;
  if (!confirm(`¿Eliminar todos los eventos de ${linea}?`)) return;
  await fetch(`${BASE}/api/uph/limpiar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ linea })
  });
  cargar();
}

cargar();
setInterval(cargar, 5000);
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/op/{op_id}", response_class=HTMLResponse)
def vista_operador(op_id: int, linea: str = "L6", db: Session = Depends(get_uph_db)):
    """
    Vista de pantalla completa para un operador (por posición 1-N en asignaciones de hoy).
    Ejemplo: /api/uph/op/1?linea=L6
    """
    hoy = datetime.now().strftime("%Y-%m-%d")

    # Obtener asignaciones de hoy para la línea, ordenadas por estación
    asignaciones = (
        db.query(Asignacion)
        .join(Linea, Asignacion.linea_id == Linea.id)
        .filter(Linea.nombre == linea, Asignacion.fecha == hoy)
        .order_by(Asignacion.estacion)
        .all()
    )

    # Agrupar estaciones por operador (num_empleado)
    grupos: dict = {}
    for asig in asignaciones:
        emp = asig.num_empleado
        if emp not in grupos:
            grupos[emp] = {
                "nombre": asig.operador.nombre if asig.operador else emp,
                "estaciones": [],
            }
        grupos[emp]["estaciones"].append(asig.estacion)

    ops_list = list(grupos.values())

    # Si no hay asignaciones, usar grupos por defecto (estaciones fijas por posición)
    if not ops_list:
        est_linea = ESTACIONES_POR_LINEA.get(linea, [])
        chunk = (len(est_linea) + 2) // 3  # dividir en 3 grupos aprox.
        ops_list = [
            {"nombre": f"Operador {i+1}", "estaciones": est_linea[i*chunk:(i+1)*chunk]}
            for i in range(3)
            if est_linea[i*chunk:(i+1)*chunk]
        ]

    if op_id < 1 or op_id > len(ops_list):
        return HTMLResponse(content=f"<h2>Operador {op_id} no encontrado para {linea} hoy</h2>", status_code=404)

    op = ops_list[op_id - 1]
    nombre = op["nombre"]
    estaciones = op["estaciones"]
    est_js = str(estaciones)  # ej. ["601","602","603"]

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Operador {op_id} — {linea}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', sans-serif; background: #0a0a0a; color: #eee;
         display: flex; flex-direction: column; min-height: 100vh; }}
  header {{ background: #1a1a2e; padding: 14px 24px; border-bottom: 2px solid #2196F3;
            display: flex; justify-content: space-between; align-items: center; }}
  .op-name {{ font-size: 1.6rem; font-weight: bold; color: #fff; }}
  .op-sub  {{ font-size: 1rem; color: #2196F3; }}
  #hora    {{ font-size: 1rem; color: #555; }}
  main {{ flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px; padding: 24px; align-content: center; }}
  .card {{ background: #141414; border: 2px solid #222; border-radius: 16px;
           padding: 28px 20px; text-align: center; transition: border-color .4s; }}
  .card.verde   {{ border-color: #22c55e; background: #052010; }}
  .card.naranja {{ border-color: #f97316; background: #1c0e00; }}
  .card.rojo    {{ border-color: #ef4444; background: #1a0404; }}
  .est-label {{ font-size: 13px; color: #666; margin-bottom: 6px; }}
  .est-num   {{ font-size: 2rem; font-weight: bold; color: #2196F3; }}
  .big {{ font-size: 4rem; font-weight: 900; margin: 14px 0; line-height: 1; }}
  .card.verde   .big {{ color: #22c55e; }}
  .card.naranja .big {{ color: #f97316; }}
  .card.rojo    .big {{ color: #ef4444; }}
  .card:not(.verde):not(.naranja):not(.rojo) .big {{ color: #555; }}
  .uph-row {{ font-size: 14px; color: #666; margin-top: 8px; }}
  .uph-val {{ font-size: 1.4rem; color: #aaa; font-weight: bold; }}
  .dot {{ display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }}
  .dot.verde   {{ background: #22c55e; box-shadow: 0 0 10px #22c55e; }}
  .dot.naranja {{ background: #f97316; box-shadow: 0 0 10px #f97316; }}
  .dot.rojo    {{ background: #ef4444; box-shadow: 0 0 10px #ef4444; }}
  footer {{ text-align: center; padding: 10px; color: #333; font-size: 12px; }}
</style>
</head>
<body>
<header>
  <div>
    <div class="op-name">{nombre}</div>
    <div class="op-sub">Línea {linea} · Operador {op_id}</div>
  </div>
  <div id="hora">—</div>
</header>
<main id="main">Cargando...</main>
<footer id="ocr-status">OCR: verificando...</footer>
<script>
const BASE = window.location.origin;
const LINEA = "{linea}";
const ESTACIONES = {est_js};
const META = 60;

function color(uph, meta) {{
  if (!meta) return '';
  const p = uph / meta;
  return p >= 0.9 ? 'verde' : p >= 0.7 ? 'naranja' : 'rojo';
}}

async function cargar() {{
  const r  = await fetch(`${{BASE}}/api/uph/datos?linea=${{LINEA}}`);
  const d  = await r.json();
  document.getElementById('hora').textContent = d.hora;

  const mapa = {{}};
  d.estaciones.forEach(e => {{ mapa[e.estacion] = e; }});

  const cards = ESTACIONES.map(est => {{
    const e   = mapa[est] || {{}};
    const cnt = e.hora_actual ?? 0;
    const uph = e.uph ?? 0;
    const cl  = color(uph, META);
    return `<div class="card ${{cl}}">
      <div class="est-label">Estación</div>
      <div class="est-num">${{est}}</div>
      <div class="big">${{cnt}}</div>
      <div class="uph-row">UPH última hora</div>
      <div class="uph-val"><span class="dot ${{cl}}"></span>${{uph.toFixed ? uph.toFixed(1) : uph}}</div>
    </div>`;
  }}).join('');

  document.getElementById('main').innerHTML = cards;

  const re = await fetch(`${{BASE}}/api/uph/estado_cliente?linea=${{LINEA}}`);
  const st = await re.json();
  document.getElementById('ocr-status').textContent =
    `OCR: ${{st.hace}} · ${{st.conectado ? '● Conectado' : '○ Sin señal'}}`;
}}

cargar();
setInterval(cargar, 5000);
</script>
</body>
</html>"""
    return HTMLResponse(content=html)


def _guardar_csv_hora(linea: str, estaciones: list, db):
    """Guarda CSV con conteo de la hora actual. Ruta: uph_logs/linea_6/YYYY/MM/DD/hora_HH.csv"""
    from sqlalchemy import text
    ahora = datetime.now(timezone.utc)
    inicio = ahora.replace(minute=0, second=0, microsecond=0)

    base = Path(__file__).parent.parent.parent / "uph_logs" / f"linea_{linea.replace('L','')}"
    carpeta = base / str(ahora.year) / f"{ahora.month:02d}" / f"{ahora.day:02d}"
    carpeta.mkdir(parents=True, exist_ok=True)
    archivo = carpeta / f"hora_{ahora.hour:02d}.csv"

    escribir_header = not archivo.exists()
    with open(archivo, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if escribir_header:
            writer.writerow(["hora", "estacion", "total_piezas"])
        for est in estaciones:
            total = db.query(func.count(EventoUPH.id)).filter(
                EventoUPH.linea == linea,
                EventoUPH.estacion == est,
                EventoUPH.evento == "GOOD",
                EventoUPH.timestamp >= inicio,
            ).scalar() or 0
            writer.writerow([ahora.strftime("%Y-%m-%d %H:00"), est, total])


def _vista_operador_fija(nombre: str, estaciones: list, op_num: int):
    """Genera HTML compacto para un tercio de pantalla con barras verticales."""
    est_js = str(estaciones)
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Op{op_num}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Inter', 'Segoe UI', sans-serif; background: #0c0c0f; color: #e2e8f0;
         display: flex; flex-direction: column; height: 100vh; overflow: hidden; }}
  header {{ background: #111318; padding: 8px 14px; border-bottom: 1px solid #1e2230;
            display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }}
  .op-name {{ font-size: 0.95rem; font-weight: 700; color: #f1f5f9; letter-spacing: .02em; }}
  .op-sub  {{ font-size: 0.65rem; color: #4a90d9; letter-spacing: .05em; text-transform: uppercase; }}
  #hora    {{ font-size: 0.7rem; color: #3a3f52; font-variant-numeric: tabular-nums; }}
  main {{ flex: 1; display: flex; flex-direction: row;
          gap: 8px; padding: 10px; min-height: 0; overflow: hidden; }}
  .card {{ flex: 1; }}
  .card {{ background: #13151c; border: 1px solid #1e2230; border-radius: 12px;
           padding: 10px 8px 8px; text-align: center; display: flex; flex-direction: column;
           align-items: center; gap: 4px; min-height: 0; transition: border-color .4s, box-shadow .4s; }}
  .card.verde   {{ border-color: #22c55e; box-shadow: 0 0 12px rgba(34,197,94,.15); }}
  .card.naranja {{ border-color: #f97316; box-shadow: 0 0 12px rgba(249,115,22,.15); }}
  .card.rojo    {{ border-color: #ef4444; box-shadow: 0 0 12px rgba(239,68,68,.15); }}
  .est-label {{ font-size: 8px; color: #3a3f52; text-transform: uppercase; letter-spacing: .08em; }}
  .est-num   {{ font-size: 1rem; font-weight: 700; color: #4a90d9; }}
  .big {{ font-size: 2.6rem; font-weight: 900; line-height: 1; letter-spacing: -.02em; }}
  .card.verde   .big {{ color: #22c55e; }}
  .card.naranja .big {{ color: #f97316; }}
  .card.rojo    .big {{ color: #ef4444; }}
  .card:not(.verde):not(.naranja):not(.rojo) .big {{ color: #2a2f3e; }}
  .uph-label {{ font-size: 8px; color: #3a3f52; }}
  .bar-wrap {{ width: 6px; flex: 1; background: #1a1d28; border-radius: 3px;
               margin: 2px auto; min-height: 30px; position: relative; overflow: hidden; }}
  .bar-fill {{ position: absolute; bottom: 0; left: 0; right: 0; border-radius: 3px;
               transition: height .6s cubic-bezier(.4,0,.2,1); }}
  .card.verde   .bar-fill {{ background: linear-gradient(to top, #16a34a, #4ade80); }}
  .card.naranja .bar-fill {{ background: linear-gradient(to top, #c2410c, #fb923c); }}
  .card.rojo    .bar-fill {{ background: linear-gradient(to top, #b91c1c, #f87171); }}
  .card:not(.verde):not(.naranja):not(.rojo) .bar-fill {{ background: #1e2230; }}
  footer {{ text-align: center; padding: 4px; color: #1e2230; font-size: 8px;
            flex-shrink: 0; letter-spacing: .05em; }}
  @keyframes pulse {{
    0%   {{ transform: scale(1);    opacity: 1; }}
    40%  {{ transform: scale(1.25); opacity: 1; }}
    100% {{ transform: scale(1);    opacity: 1; }}
  }}
  .big.pulse {{ animation: pulse .4s ease-out; }}
  @keyframes floatUp {{
    0%   {{ opacity: 1; transform: translateY(0)   scale(1); }}
    100% {{ opacity: 0; transform: translateY(-36px) scale(1.3); }}
  }}
  .plus-one {{
    position: absolute; pointer-events: none;
    font-size: 1rem; font-weight: 900;
    color: #4ade80; text-shadow: 0 0 8px rgba(74,222,128,.6);
    animation: floatUp .8s ease-out forwards;
    white-space: nowrap;
  }}
  .card {{ position: relative; }}
</style>
</head>
<body>
<header>
  <div>
    <div class="op-name">{nombre}</div>
    <div class="op-sub">Línea 6 · Op {op_num}</div>
  </div>
  <div id="hora">—</div>
</header>
<main id="main">Cargando...</main>
<footer id="reset-info">—</footer>
<script>
const BASE = window.location.origin;
const ESTACIONES = {est_js};
const META_HORA = 60;
let horaActual = new Date().getHours();

function color(cnt) {{
  if (cnt === 0) return '';
  if (cnt >= 50) return 'verde';
  if (cnt >= 35) return 'naranja';
  return 'rojo';
}}

async function cargar() {{
  const ahora = new Date();
  const h = ahora.getHours();

  if (h !== horaActual) {{
    horaActual = h;
    location.reload();
    return;
  }}

  document.getElementById('hora').textContent =
    ahora.toLocaleTimeString('es-MX', {{hour:'2-digit', minute:'2-digit', second:'2-digit'}});

  const minRestantes = 60 - ahora.getMinutes();
  document.getElementById('reset-info').textContent =
    `Reinicia en ${{minRestantes}} min`;

  try {{
    const r = await fetch(`${{BASE}}/api/uph/datos?linea=L6`);
    const d = await r.json();
    const mapa = {{}};
    d.estaciones.forEach(e => {{ mapa[e.estacion] = e; }});

    const main = document.getElementById('main');
    if (main.querySelector('.card') === null) main.innerHTML = '';

    ESTACIONES.forEach(est => {{
      const e = mapa[String(est)] || {{}};
      const cnt = e.hora_actual ?? 0;
      const uph = e.uph ?? 0;
      const cl = color(cnt);
      const pct = Math.min(Math.round((cnt / META_HORA) * 100), 100);

      let card = document.getElementById(`card-${{est}}`);
      const esNuevo = !card;
      if (esNuevo) {{
        card = document.createElement('div');
        card.id = `card-${{est}}`;
        card.className = `card ${{cl}}`;
        card.innerHTML = `
          <div class="est-label">Estación</div>
          <div class="est-num">${{est}}</div>
          <div class="big" id="big-${{est}}">${{cnt}}</div>
          <div class="bar-wrap"><div class="bar-fill" id="bar-${{est}}" style="height:${{pct}}%"></div></div>
          <div class="uph-label" id="uph-${{est}}">UPH ${{uph}}/hr</div>
        `;
        main.appendChild(card);
      }} else {{
        const bigEl = document.getElementById(`big-${{est}}`);
        const prevCnt = parseInt(bigEl.textContent) || 0;

        // Actualizar valores
        card.className = `card ${{cl}}`;
        bigEl.textContent = cnt;
        document.getElementById(`bar-${{est}}`).style.height = pct + '%';
        document.getElementById(`uph-${{est}}`).textContent = `UPH ${{uph}}/hr`;

        // Pulso y +N flotante cuando llega pieza nueva
        if (cnt > prevCnt) {{
          bigEl.classList.remove('pulse');
          void bigEl.offsetWidth;
          bigEl.classList.add('pulse');

          const diff = cnt - prevCnt;
          const tag = document.createElement('div');
          tag.className = 'plus-one';
          tag.textContent = `+${{diff}}`;
          tag.style.top = '50%';
          tag.style.left = '50%';
          tag.style.transform = 'translate(-50%, -50%)';
          card.appendChild(tag);
          setTimeout(() => tag.remove(), 850);
        }}
      }}
    }});
  }} catch(err) {{
    document.getElementById('main').innerHTML = '<p style="color:#333;padding:20px;font-size:12px">Sin conexión</p>';
  }}
}}

cargar();
setInterval(cargar, 1000);
</script>
</body>
</html>"""


@router.get("/op1", response_class=HTMLResponse)
def vista_op1():
    """Operador 1 — Estaciones 603, 604, 605"""
    return HTMLResponse(_vista_operador_fija("Operador 1", ["603","604","605"], 1))


@router.get("/op2", response_class=HTMLResponse)
def vista_op2():
    """Operador 2 — Estaciones 606, 607, 608"""
    return HTMLResponse(_vista_operador_fija("Operador 2", ["606","607","608"], 2))


@router.post("/guardar_hora")
def guardar_csv_hora(linea: str = "L6", db: Session = Depends(get_uph_db)):
    """Guarda CSV con conteo de la hora actual para todas las estaciones de la línea."""
    estaciones = ESTACIONES_POR_LINEA.get(linea, [])
    _guardar_csv_hora(linea, estaciones, db)
    return {"ok": True}
