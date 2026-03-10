"""
Router UPH/Andon - Sistema de producción Hisense
- Recibe eventos OCR de PCs de empaque
- Calcula UPH en ventana móvil de 1 hora
- Semáforo: Verde ≥90%, Naranja ≥70%, Rojo <70%
- Ranking semanal de operadores
- Gestión de operadores, modelos y asignaciones
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from ..database_uph import get_uph_db
from ..models.uph_models import Operador, Linea, ModeloUPH, Turno, Asignacion, EventoUPH
from ..auth import get_current_user
from ..models.models import Tecnico

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
    uph_total: float
    linea_id: int


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


def _uph_ultima_hora(db: Session, linea: str, estacion: Optional[str] = None) -> float:
    """Cuenta eventos GOOD en la última hora móvil."""
    ahora = datetime.now(timezone.utc)
    desde = ahora - timedelta(hours=1)
    q = db.query(func.count(EventoUPH.id)).filter(
        EventoUPH.linea == linea,
        EventoUPH.evento == "GOOD",
        EventoUPH.timestamp >= desde,
        EventoUPH.timestamp <= ahora,
    )
    if estacion:
        q = q.filter(EventoUPH.estacion == estacion)
    return float(q.scalar() or 0)


def _ensure_admin_or_jefa(current_user: Tecnico):
    if current_user.tipo_usuario not in ("admin", "superadmin", "ingeniero", "lider_linea"):
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

    ts = datetime.now(timezone.utc)
    if evento.timestamp:
        try:
            ts = datetime.fromisoformat(evento.timestamp)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    registro = EventoUPH(
        linea=evento.linea,
        estacion=evento.estacion,
        evento=evento.evento,
        contador=evento.contador,
        timestamp=ts,
    )
    db.add(registro)
    db.commit()
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

    estaciones_activas = len(set(a.estacion for a in asignaciones))
    uph_meta_estacion = (modelo.uph_total / estaciones_activas) if (modelo and estaciones_activas > 0) else 0

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
    uph_meta_linea = modelo.uph_total if modelo else 0

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
    Top 3 operadores por UPH promedio de los últimos 7 días.
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
        # UPH promedio = total eventos / 7 días / horas por turno (12h)
        uph_promedio = round(row.total_eventos / 7 / 12, 2)
        ranking.append({
            "estacion": row.estacion,
            "num_empleado": operador.num_empleado if operador else None,
            "nombre": operador.nombre if operador else "Sin asignar",
            "foto_url": operador.foto_url if operador else None,
            "uph_promedio": uph_promedio,
            "total_eventos": row.total_eventos,
        })

    ranking.sort(key=lambda x: x["uph_promedio"], reverse=True)
    return {"ranking": ranking[:3], "periodo_dias": 7}


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
    operadores = db.query(Operador).filter(Operador.activo == True).all()
    return [
        {
            "num_empleado": o.num_empleado,
            "nombre": o.nombre,
            "foto_url": o.foto_url,
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
    _ensure_admin_or_jefa(current_user)
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


@router.get("/modelos")
def listar_modelos(
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    modelos = db.query(ModeloUPH).all()
    return [
        {
            "id": m.id,
            "nombre": m.nombre,
            "uph_total": m.uph_total,
            "linea_id": m.linea_id,
            "linea": m.linea.nombre if m.linea else None,
        }
        for m in modelos
    ]


@router.post("/modelos", status_code=201)
def crear_modelo(
    data: ModeloUPHIn,
    db: Session = Depends(get_uph_db),
    current_user: Tecnico = Depends(get_current_user),
):
    _ensure_admin_or_jefa(current_user)
    linea = db.query(Linea).filter(Linea.id == data.linea_id).first()
    if not linea:
        raise HTTPException(status_code=404, detail="Línea no encontrada")

    modelo = ModeloUPH(**data.model_dump())
    db.add(modelo)
    db.commit()
    db.refresh(modelo)
    return {"id": modelo.id, "ok": True}


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
