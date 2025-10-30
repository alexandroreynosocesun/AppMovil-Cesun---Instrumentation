from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.models import Jig, Validacion, Reparacion, JigNG
from ..schemas import Jig as JigSchema, JigCreate, JigHistorial, Validacion as ValidacionSchema, Reparacion as ReparacionSchema, JigNG as JigNGSchema
from ..auth import get_current_user
from ..models.models import Tecnico

router = APIRouter()

@router.get("/", response_model=List[JigSchema])
async def get_jigs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener lista de jigs"""
    jigs = db.query(Jig).offset(skip).limit(limit).all()
    return jigs

@router.get("/qr/{codigo_qr}", response_model=JigHistorial)
async def get_jig_by_qr(
    codigo_qr: str,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jig por código QR con historial"""
    jig = db.query(Jig).filter(Jig.codigo_qr == codigo_qr).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    # Obtener validaciones, reparaciones y jigs NG
    validaciones = db.query(Validacion).filter(Validacion.jig_id == jig.id).all()
    reparaciones = db.query(Reparacion).filter(Reparacion.jig_id == jig.id).all()
    jigs_ng = db.query(JigNG).filter(JigNG.jig_id == jig.id).all()
    
    # Convertir a esquemas Pydantic
    validaciones_schema = [ValidacionSchema.from_orm(v) for v in validaciones]
    reparaciones_schema = [ReparacionSchema.from_orm(r) for r in reparaciones]
    
    # Serializar jigs_ng manualmente para manejar las relaciones
    jigs_ng_schema = []
    for jig_ng in jigs_ng:
        jig_ng_dict = {
            "id": jig_ng.id,
            "jig_id": jig_ng.jig_id,
            "tecnico_id": jig_ng.tecnico_id,
            "fecha_ng": jig_ng.fecha_ng,
            "motivo": jig_ng.motivo,
            "categoria": jig_ng.categoria,
            "prioridad": jig_ng.prioridad,
            "estado": jig_ng.estado,
            "fecha_reparacion": jig_ng.fecha_reparacion,
            "tecnico_reparacion_id": jig_ng.tecnico_reparacion_id,
            "observaciones_reparacion": jig_ng.observaciones_reparacion,
            "sincronizado": jig_ng.sincronizado,
            "created_at": jig_ng.created_at,
            "tecnico_ng": {
                "id": jig_ng.tecnico_ng.id,
                "nombre": jig_ng.tecnico_ng.nombre,
                "numero_empleado": jig_ng.tecnico_ng.numero_empleado
            } if jig_ng.tecnico_ng else None,
            "tecnico_reparacion": {
                "id": jig_ng.tecnico_reparacion.id,
                "nombre": jig_ng.tecnico_reparacion.nombre,
                "numero_empleado": jig_ng.tecnico_reparacion.numero_empleado
            } if jig_ng.tecnico_reparacion else None
        }
        jigs_ng_schema.append(jig_ng_dict)
    
    return JigHistorial(
        jig=JigSchema.from_orm(jig),
        validaciones=validaciones_schema,
        reparaciones=reparaciones_schema,
        jigs_ng=jigs_ng_schema
    )

@router.get("/{jig_id}", response_model=JigSchema)
async def get_jig_by_id(
    jig_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jig por ID"""
    jig = db.query(Jig).filter(Jig.id == jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    return jig

@router.post("/", response_model=JigSchema)
async def create_jig(
    jig_data: JigCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear nuevo jig"""
    # Verificar si el código QR ya existe
    existing_jig = db.query(Jig).filter(Jig.codigo_qr == jig_data.codigo_qr).first()
    if existing_jig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código QR ya existe"
        )
    
    db_jig = Jig(**jig_data.dict())
    db.add(db_jig)
    db.commit()
    db.refresh(db_jig)
    
    return JigSchema.from_orm(db_jig)

@router.put("/{jig_id}", response_model=JigSchema)
async def update_jig(
    jig_id: int,
    jig_data: JigCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar jig existente"""
    jig = db.query(Jig).filter(Jig.id == jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    for field, value in jig_data.dict().items():
        setattr(jig, field, value)
    
    db.commit()
    db.refresh(jig)
    
    return JigSchema.from_orm(jig)

@router.delete("/{jig_id}")
async def delete_jig(
    jig_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar jig (hard delete)"""
    jig = db.query(Jig).filter(Jig.id == jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    try:
        # Eliminar primero todas las validaciones asociadas
        db.query(Validacion).filter(Validacion.jig_id == jig_id).delete()
        
        # Eliminar todas las reparaciones asociadas
        db.query(Reparacion).filter(Reparacion.jig_id == jig_id).delete()
        
        # Eliminar todos los jigs NG asociados
        db.query(JigNG).filter(JigNG.jig_id == jig_id).delete()
        
        # Finalmente eliminar el jig
        db.delete(jig)
        db.commit()
        
        return {"message": "Jig eliminado correctamente"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar jig: {str(e)}"
        )
