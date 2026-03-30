"""
MES FCT — recibe JSON con OK/NG/Pass% desde el agente FCT (OCR local),
persiste en DB y sirve el dashboard.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..auth import get_current_user
from ..database import get_db
from ..models.models import Tecnico
from ..models.mes_models import MESRegistro

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mes", tags=["mes"])


class EstacionData(BaseModel):
    ok:       Optional[int]   = None
    ng:       Optional[int]   = None
    pass_pct: Optional[float] = None


class CapturaIn(BaseModel):
    estacion_id: str          = "FCT-1"
    modelo:      Optional[str] = None
    estacion_a:  EstacionData  = EstacionData()
    estacion_b:  EstacionData  = EstacionData()


@router.post("/captura")
def capturar_mes(data: CapturaIn, db: Session = Depends(get_db)):
    """
    Recibe OK/NG/Pass% ya extraídos por el agente FCT (OCR local).
    No requiere autenticación — lo llama el agente PC.
    """
    registro = MESRegistro(
        estacion_id = data.estacion_id,
        modelo      = data.modelo,
        ok_a        = data.estacion_a.ok,
        ng_a        = data.estacion_a.ng,
        pass_pct_a  = data.estacion_a.pass_pct,
        ok_b        = data.estacion_b.ok,
        ng_b        = data.estacion_b.ng,
        pass_pct_b  = data.estacion_b.pass_pct,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    logger.info(
        f"[MES] {data.estacion_id} modelo={data.modelo} "
        f"A:{data.estacion_a.ok}/{data.estacion_a.ng} {data.estacion_a.pass_pct}% "
        f"B:{data.estacion_b.ok}/{data.estacion_b.ng} {data.estacion_b.pass_pct}%"
    )
    return {"id": registro.id, "ok": True}


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
            "id": r.id, "modelo": r.modelo,
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
    rows = db.query(MESRegistro.estacion_id).distinct().all()
    return [r[0] for r in rows]
