"""
Router UPH/Andon - Sistema de producción Hisense
- Recibe eventos OCR de PCs de empaque
- Calcula UPH en ventana móvil de 1 hora
- Semáforo: Verde ≥90%, Naranja ≥70%, Rojo <70%
- Ranking semanal de operadores
- Gestión de operadores, modelos y asignaciones
"""

from fastapi import APIRouter, Depends, HTTPException, Request
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


# ─────────────────────────────────────────────
# Endpoints de testing / dashboard
# ─────────────────────────────────────────────

ESTACIONES_POR_LINEA = {
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
