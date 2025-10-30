from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ..database import get_db
from ..models.models import Tecnico, SolicitudRegistro
from ..schemas import Tecnico as TecnicoSchema, TecnicoCreate, SolicitudRegistroResponse, SolicitudRegistroUpdate
from ..auth import get_password_hash, get_current_user
from ..services.notification_service import notification_service

router = APIRouter()

# Lista de usuarios administradores (solo estos pueden acceder)
ADMIN_USERS = ["admin", "superadmin"]  # Agrega tu usuario aquí

def verify_admin(current_user: Tecnico = Depends(get_current_user)):
    """Verificar que el usuario es administrador"""
    if current_user.usuario not in ADMIN_USERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo administradores pueden acceder a esta función."
        )
    return current_user

@router.get("/users", response_model=List[TecnicoSchema])
async def get_all_users(
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Obtener todos los usuarios (solo administradores)"""
    users = db.query(Tecnico).all()
    return users

@router.get("/users/{user_id}", response_model=TecnicoSchema)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Obtener usuario específico por ID"""
    user = db.query(Tecnico).filter(Tecnico.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    return user

@router.post("/users", response_model=TecnicoSchema)
async def create_user(
    user_data: TecnicoCreate,
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Crear nuevo usuario (solo administradores)"""
    # Verificar si el usuario ya existe
    existing_user = db.query(Tecnico).filter(Tecnico.usuario == user_data.usuario).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya existe"
        )
    
    # Crear nuevo usuario
    hashed_password = get_password_hash(user_data.password)
    db_user = Tecnico(
        usuario=user_data.usuario,
        nombre=user_data.nombre,
        pin=user_data.pin,
        password_hash=hashed_password
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.put("/users/{user_id}", response_model=TecnicoSchema)
async def update_user(
    user_id: int,
    user_data: TecnicoCreate,
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Actualizar usuario (solo administradores)"""
    user = db.query(Tecnico).filter(Tecnico.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar si el nuevo usuario ya existe (si cambió el nombre)
    if user_data.usuario != user.usuario:
        existing_user = db.query(Tecnico).filter(Tecnico.usuario == user_data.usuario).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario ya existe"
            )
    
    # Actualizar datos
    user.usuario = user_data.usuario
    user.nombre = user_data.nombre
    user.pin = user_data.pin
    user.password_hash = get_password_hash(user_data.password)
    
    db.commit()
    db.refresh(user)
    
    return user

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Eliminar usuario (solo administradores)"""
    user = db.query(Tecnico).filter(Tecnico.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # No permitir eliminar al propio administrador
    if user.usuario == admin_user.usuario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propio usuario"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "Usuario eliminado correctamente"}

@router.get("/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Obtener estadísticas del sistema (solo administradores)"""
    total_users = db.query(Tecnico).count()
    pending_requests = db.query(SolicitudRegistro).filter(SolicitudRegistro.estado == "pendiente").count()
    
    return {
        "total_users": total_users,
        "pending_requests": pending_requests,
        "admin_users": len(ADMIN_USERS),
        "current_admin": admin_user.usuario
    }

# ===== GESTIÓN DE SOLICITUDES DE REGISTRO =====

@router.get("/solicitudes", response_model=List[SolicitudRegistroResponse])
async def get_solicitudes_registro(
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Obtener todas las solicitudes de registro (solo administradores)"""
    solicitudes = db.query(SolicitudRegistro).order_by(SolicitudRegistro.fecha_solicitud.desc()).all()
    return solicitudes

@router.get("/solicitudes/pendientes", response_model=List[SolicitudRegistroResponse])
async def get_solicitudes_pendientes(
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Obtener solo las solicitudes pendientes (solo administradores)"""
    solicitudes = db.query(SolicitudRegistro).filter(
        SolicitudRegistro.estado == "pendiente"
    ).order_by(SolicitudRegistro.fecha_solicitud.desc()).all()
    return solicitudes

@router.get("/solicitudes/{solicitud_id}", response_model=SolicitudRegistroResponse)
async def get_solicitud_detalle(
    solicitud_id: int,
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Obtener detalles de una solicitud específica (solo administradores)"""
    solicitud = db.query(SolicitudRegistro).filter(SolicitudRegistro.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    return solicitud

@router.post("/solicitudes/{solicitud_id}/aprobar")
async def aprobar_solicitud(
    solicitud_id: int,
    request_data: dict = None,
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Aprobar una solicitud de registro (solo administradores)"""
    comentarios = request_data.get('comentarios', '') if request_data else ''
    solicitud = db.query(SolicitudRegistro).filter(SolicitudRegistro.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    
    if solicitud.estado != "pendiente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La solicitud ya fue procesada"
        )
    
    # Verificar que el usuario no exista ya
    existing_user = db.query(Tecnico).filter(Tecnico.usuario == solicitud.usuario).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya existe en el sistema"
        )
    
    # Verificar que el número de empleado no exista ya
    existing_employee = db.query(Tecnico).filter(Tecnico.numero_empleado == solicitud.numero_empleado).first()
    if existing_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El número de empleado ya existe en el sistema"
        )
    
    try:
        # Crear el nuevo usuario
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        nuevo_usuario = Tecnico(
            usuario=solicitud.usuario,
            nombre=solicitud.nombre,
            numero_empleado=solicitud.numero_empleado,
            password_hash=solicitud.password_hash,
            firma_digital=solicitud.firma_digital,
            turno_actual="mañana",
            tipo_tecnico="Técnico de Instrumentación"
        )
        
        db.add(nuevo_usuario)
        
        # Actualizar la solicitud
        solicitud.estado = "aprobada"
        solicitud.admin_id = admin_user.id
        solicitud.fecha_respuesta = datetime.utcnow()
        solicitud.comentarios_admin = comentarios
        
        db.commit()
        db.refresh(nuevo_usuario)
        db.refresh(solicitud)
        
        # Enviar notificación de aprobación (asíncrono)
        try:
            notification_service.send_registration_approved_notification(
                usuario=solicitud.usuario,
                nombre=solicitud.nombre,
                email=None  # Por ahora no tenemos email en el modelo
            )
        except Exception as e:
            # No fallar si la notificación falla
            print(f"Error enviando notificación: {e}")
        
        return {
            "message": "Solicitud aprobada correctamente",
            "usuario_creado": {
                "id": nuevo_usuario.id,
                "usuario": nuevo_usuario.usuario,
                "nombre": nuevo_usuario.nombre,
                "numero_empleado": nuevo_usuario.numero_empleado
            },
            "solicitud": solicitud
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al aprobar la solicitud: {str(e)}"
        )

@router.post("/solicitudes/{solicitud_id}/rechazar")
async def rechazar_solicitud(
    solicitud_id: int,
    request_data: dict,
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Rechazar una solicitud de registro (solo administradores)"""
    comentarios = request_data.get('comentarios', '')
    if not comentarios.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los comentarios son obligatorios para rechazar una solicitud"
        )
    
    solicitud = db.query(SolicitudRegistro).filter(SolicitudRegistro.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    
    if solicitud.estado != "pendiente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La solicitud ya fue procesada"
        )
    
    # Actualizar la solicitud
    solicitud.estado = "rechazada"
    solicitud.admin_id = admin_user.id
    solicitud.fecha_respuesta = datetime.utcnow()
    solicitud.comentarios_admin = comentarios
    
    db.commit()
    db.refresh(solicitud)
    
    # Enviar notificación de rechazo (asíncrono)
    try:
        notification_service.send_registration_rejected_notification(
            usuario=solicitud.usuario,
            nombre=solicitud.nombre,
            motivo=comentarios,
            email=None  # Por ahora no tenemos email en el modelo
        )
    except Exception as e:
        # No fallar si la notificación falla
        print(f"Error enviando notificación: {e}")
    
    return {
        "message": "Solicitud rechazada correctamente",
        "solicitud": solicitud
    }
