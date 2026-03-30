"""
MES FCT — recibe screenshot de estación FCT, extrae OK/NG/Pass% con Claude Vision
y persiste en DB. Sirve dashboard y historial.
"""
import re
import json
import base64
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..auth import get_current_user
from ..database import get_db
from ..models.models import Tecnico
from ..models.mes_models import MESRegistro
from ..config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mes", tags=["mes"])

PROMPT_FCT = """Analiza este screenshot del sistema TV PCBA AutoTestSystem de Hisense.
Extrae los datos de AMBAS estaciones (A y B) visibles en pantalla.

Devuelve SOLO JSON válido con esta estructura exacta:
{
  "modelo": "nombre del modelo que aparece en la barra de título de la estación (ej: 53149-65C350NUF)",
  "estacion_a": {
    "ok": número entero de OKCount o null,
    "ng": número entero de NGCount o null,
    "pass_pct": número decimal del Pass(%) o null
  },
  "estacion_b": {
    "ok": número entero de OKCount o null,
    "ng": número entero de NGCount o null,
    "pass_pct": número decimal del Pass(%) o null
  }
}

Si una estación no está visible o no tiene datos, usa null en sus campos.
Devuelve SOLO el JSON, sin texto adicional."""


def _extraer_json(texto: str) -> dict:
    texto = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', texto)
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', texto)
    if m:
        texto = m.group(1)
    texto = texto.strip()
    return json.loads(texto)


@router.post("/captura")
async def capturar_mes(
    imagen: UploadFile = File(...),
    estacion_id: str = Form(default="FCT-1"),
    db: Session = Depends(get_db),
):
    """
    Recibe screenshot desde el agente FCT, lo analiza con Claude Vision
    y guarda OK/NG/Pass% en la DB.
    No requiere autenticación (lo llama el agente PC).
    """
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="API key no configurada")

    img_bytes = await imagen.read()
    img_b64   = base64.standard_b64encode(img_bytes).decode("utf-8")
    media_type = imagen.content_type or "image/png"

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": img_b64}},
                    {"type": "text", "text": PROMPT_FCT},
                ],
            }],
        )
        texto = resp.content[0].text
        logger.info(f"[MES] Claude respuesta: {texto[:200]}")
        datos = _extraer_json(texto)
    except Exception as e:
        logger.error(f"[MES] Error Claude Vision: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando imagen: {e}")

    a = datos.get("estacion_a") or {}
    b = datos.get("estacion_b") or {}

    registro = MESRegistro(
        estacion_id  = estacion_id,
        modelo       = datos.get("modelo"),
        ok_a         = a.get("ok"),
        ng_a         = a.get("ng"),
        pass_pct_a   = a.get("pass_pct"),
        ok_b         = b.get("ok"),
        ng_b         = b.get("ng"),
        pass_pct_b   = b.get("pass_pct"),
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)

    return {
        "id": registro.id,
        "estacion_id": registro.estacion_id,
        "modelo": registro.modelo,
        "estacion_a": {"ok": registro.ok_a, "ng": registro.ng_a, "pass_pct": registro.pass_pct_a},
        "estacion_b": {"ok": registro.ok_b, "ng": registro.ng_b, "pass_pct": registro.pass_pct_b},
        "capturado_en": registro.capturado_en.isoformat() if registro.capturado_en else None,
    }


@router.get("/dashboard")
def dashboard_mes(
    estacion_id: str = "FCT-1",
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Último registro + historial de las últimas 2 horas."""
    ultimo = (
        db.query(MESRegistro)
        .filter(MESRegistro.estacion_id == estacion_id)
        .order_by(desc(MESRegistro.capturado_en))
        .first()
    )

    hace_2h = datetime.now(timezone.utc) - timedelta(hours=2)
    historial = (
        db.query(MESRegistro)
        .filter(
            MESRegistro.estacion_id == estacion_id,
            MESRegistro.capturado_en >= hace_2h,
        )
        .order_by(MESRegistro.capturado_en)
        .all()
    )

    def to_dict(r):
        return {
            "id": r.id,
            "modelo": r.modelo,
            "ok_a": r.ok_a, "ng_a": r.ng_a, "pass_pct_a": r.pass_pct_a,
            "ok_b": r.ok_b, "ng_b": r.ng_b, "pass_pct_b": r.pass_pct_b,
            "ts": r.capturado_en.isoformat() if r.capturado_en else None,
        }

    return {
        "actual": to_dict(ultimo) if ultimo else None,
        "historial": [to_dict(r) for r in historial],
    }


@router.get("/estaciones")
def listar_estaciones(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Lista estaciones FCT que han enviado datos."""
    rows = db.query(MESRegistro.estacion_id).distinct().all()
    return [r[0] for r in rows]
