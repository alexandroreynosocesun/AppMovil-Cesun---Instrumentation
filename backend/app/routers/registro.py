from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ..database import get_db
from ..models.models import SolicitudRegistro, Tecnico
from ..schemas import SolicitudRegistroCreate, SolicitudRegistroResponse, SolicitudRegistroUpdate
from ..auth import get_current_user
from passlib.context import CryptContext
from ..utils.logger import get_logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = get_logger(__name__)

router = APIRouter()

@router.post("/", response_model=SolicitudRegistroResponse)
async def create_solicitud_registro(
    solicitud_data: SolicitudRegistroCreate,
    db: Session = Depends(get_db)
):
    """Crear nueva solicitud de registro"""
    # Verificar si el usuario ya existe
    existing_user = db.query(Tecnico).filter(Tecnico.usuario == solicitud_data.usuario).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya existe"
        )
    
    # Verificar si ya hay una solicitud pendiente para este usuario
    existing_solicitud = db.query(SolicitudRegistro).filter(
        SolicitudRegistro.usuario == solicitud_data.usuario,
        SolicitudRegistro.estado == "pendiente"
    ).first()
    
    if existing_solicitud:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una solicitud pendiente para este usuario"
        )
    
    # Verificar si el número de empleado ya existe
    existing_employee = db.query(Tecnico).filter(Tecnico.numero_empleado == solicitud_data.numero_empleado).first()
    if existing_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El número de empleado ya existe"
        )
    
    # Verificar solicitud pendiente con mismo número de empleado
    existing_solicitud_employee = db.query(SolicitudRegistro).filter(
        SolicitudRegistro.numero_empleado == solicitud_data.numero_empleado,
        SolicitudRegistro.estado == "pendiente"
    ).first()
    
    if existing_solicitud_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una solicitud pendiente para este número de empleado"
        )
    
    # Crear la solicitud
    db_solicitud = SolicitudRegistro(
        usuario=solicitud_data.usuario,
        nombre=solicitud_data.nombre,
        numero_empleado=solicitud_data.numero_empleado,
        password_hash=pwd_context.hash(solicitud_data.password),
        firma_digital=solicitud_data.firma_digital
    )
    
    db.add(db_solicitud)
    db.commit()
    db.refresh(db_solicitud)
    
    return SolicitudRegistroResponse.from_orm(db_solicitud)

@router.get("/", response_model=List[SolicitudRegistroResponse])
async def get_solicitudes_registro(
    skip: int = 0,
    limit: int = 100,
    estado: str = None,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener solicitudes de registro (solo para administradores)"""
    # Verificar que el usuario sea administrador
    if current_user.usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver solicitudes de registro"
        )
    
    query = db.query(SolicitudRegistro)
    
    if estado:
        query = query.filter(SolicitudRegistro.estado == estado)
    
    solicitudes = query.offset(skip).limit(limit).order_by(SolicitudRegistro.fecha_solicitud.desc()).all()
    return solicitudes

@router.get("/{solicitud_id}", response_model=SolicitudRegistroResponse)
async def get_solicitud_registro(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener solicitud de registro por ID (solo para administradores)"""
    # Verificar que el usuario sea administrador
    if current_user.usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver solicitudes de registro"
        )
    
    solicitud = db.query(SolicitudRegistro).filter(SolicitudRegistro.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    
    return SolicitudRegistroResponse.from_orm(solicitud)

@router.put("/{solicitud_id}", response_model=SolicitudRegistroResponse)
async def update_solicitud_registro(
    solicitud_id: int,
    solicitud_data: SolicitudRegistroUpdate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar solicitud de registro (solo para administradores)"""
    # Verificar que el usuario sea administrador
    if current_user.usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para actualizar solicitudes de registro"
        )
    
    solicitud = db.query(SolicitudRegistro).filter(SolicitudRegistro.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    
    # Actualizar campos
    for field, value in solicitud_data.dict(exclude_unset=True).items():
        setattr(solicitud, field, value)
    
    solicitud.admin_id = current_user.id
    solicitud.fecha_respuesta = datetime.utcnow()
    
    # Si se aprueba, crear el usuario
    if solicitud_data.estado == "aprobada":
        nuevo_usuario = Tecnico(
            usuario=solicitud.usuario,
            nombre=solicitud.nombre,
            numero_empleado=solicitud.numero_empleado,
            password_hash=solicitud.password_hash,
            firma_digital=solicitud.firma_digital,
            turno_actual=solicitud.turno_actual or "A",
            tipo_tecnico="Técnico de Instrumentación",  # Tipo por defecto
            activo=True
        )
        db.add(nuevo_usuario)
    
    db.commit()
    db.refresh(solicitud)
    
    return SolicitudRegistroResponse.from_orm(solicitud)

@router.delete("/{solicitud_id}")
async def delete_solicitud_registro(
    solicitud_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar solicitud de registro (solo para administradores)"""
    # Verificar que el usuario sea administrador
    if current_user.usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar solicitudes de registro"
        )
    
    solicitud = db.query(SolicitudRegistro).filter(SolicitudRegistro.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    
    db.delete(solicitud)
    db.commit()
    
    return {"message": "Solicitud eliminada correctamente"}

@router.get("/stats/summary")
async def get_registro_stats(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener estadísticas de solicitudes de registro"""
    # Verificar que el usuario sea administrador
    if current_user.usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver estadísticas"
        )
    
    total = db.query(SolicitudRegistro).count()
    pendientes = db.query(SolicitudRegistro).filter(SolicitudRegistro.estado == "pendiente").count()
    aprobadas = db.query(SolicitudRegistro).filter(SolicitudRegistro.estado == "aprobada").count()
    rechazadas = db.query(SolicitudRegistro).filter(SolicitudRegistro.estado == "rechazada").count()
    
    return {
        "total": total,
        "pendientes": pendientes,
        "aprobadas": aprobadas,
        "rechazadas": rechazadas
    }
