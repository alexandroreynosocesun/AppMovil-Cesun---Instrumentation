from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from ..database import get_db
from ..models.models import ModeloObservacion, Tecnico
from ..auth import get_current_user

router = APIRouter()


class ObservacionCreate(BaseModel):
    modelo_mainboard: str
    texto: str
    foto: Optional[str] = None  # Base64 image (opcional)


class ObservacionOut(BaseModel):
    id: int
    modelo_mainboard: str
    texto: str
    foto: Optional[str] = None
    tecnico_nombre: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


def ensure_admin_or_engineer(current_user: Tecnico):
    if current_user.tipo_usuario not in ["admin", "superadmin", "ingeniero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o ingenieros pueden eliminar observaciones."
        )


@router.get("/", response_model=List[ObservacionOut])
async def get_observaciones(
    modelo_mainboard: str = Query(..., description="Modelo de mainboard"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    rows = (
        db.query(ModeloObservacion)
        .filter(ModeloObservacion.modelo_mainboard == modelo_mainboard)
        .order_by(ModeloObservacion.created_at.desc())
        .all()
    )
    result = []
    for row in rows:
        result.append(ObservacionOut(
            id=row.id,
            modelo_mainboard=row.modelo_mainboard,
            texto=row.texto,
            foto=row.foto,
            tecnico_nombre=row.tecnico.nombre if row.tecnico else None,
            created_at=row.created_at,
        ))
    return result


@router.post("/", response_model=ObservacionOut, status_code=status.HTTP_201_CREATED)
async def create_observacion(
    data: ObservacionCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    obs = ModeloObservacion(
        modelo_mainboard=data.modelo_mainboard.strip(),
        texto=data.texto.strip(),
        foto=data.foto,
        tecnico_id=current_user.id,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return ObservacionOut(
        id=obs.id,
        modelo_mainboard=obs.modelo_mainboard,
        texto=obs.texto,
        foto=obs.foto,
        tecnico_nombre=current_user.nombre,
        created_at=obs.created_at,
    )


@router.delete("/{obs_id}", status_code=status.HTTP_200_OK)
async def delete_observacion(
    obs_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    ensure_admin_or_engineer(current_user)
    obs = db.query(ModeloObservacion).filter(ModeloObservacion.id == obs_id).first()
    if not obs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observación no encontrada")
    db.delete(obs)
    db.commit()
    return {"message": "Observación eliminada", "id": obs_id}
