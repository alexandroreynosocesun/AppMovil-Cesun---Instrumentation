from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ..database import get_db
from ..models.models import Tecnico, SolicitudRegistro
from ..schemas import Tecnico as TecnicoSchema, TecnicoCreate, SolicitudRegistroResponse, SolicitudRegistroUpdate, PaginatedResponse
from ..auth import get_password_hash, get_current_user
from ..services.notification_service import notification_service
from ..utils.pagination import paginate_query
from ..utils.logger import api_logger

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

@router.get("/users", response_model=PaginatedResponse[TecnicoSchema])
async def get_all_users(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """
    Obtener todos los usuarios con paginación (solo administradores)
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    """
    query = db.query(Tecnico).order_by(Tecnico.created_at.desc())
    items, total, pages = paginate_query(query, page, page_size)
    
    return PaginatedResponse(
        items=[TecnicoSchema.from_orm(user) for user in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/tecnicos", response_model=PaginatedResponse[TecnicoSchema])
async def get_tecnicos(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener lista paginada de técnicos disponibles para asignación
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    
    Permite acceso a todos los roles excepto gestión (para ver nombres de técnicos en validaciones)
    """
    api_logger.debug(f"[GET_TECNICOS] Usuario actual: {current_user.usuario}, tipo_usuario: {current_user.tipo_usuario}")
    
    # Permitir acceso a todos los roles excepto gestión
    if current_user.tipo_usuario == 'gestion' or current_user.tipo_usuario == 'Gestion':
        api_logger.warning(f"[GET_TECNICOS] Acceso denegado para usuario {current_user.usuario} (rol: {current_user.tipo_usuario})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Los usuarios de gestión no pueden acceder a esta información."
        )
    
    # Obtener solo técnicos (usuarios con tipo_usuario = 'tecnico' o 'validacion')
    # Excluir explícitamente: ingeniero, asignaciones, admin, gestion, etc.
    # El filtro IN solo incluye 'tecnico' y 'validacion', excluyendo automáticamente:
    # - asignaciones
    # - ingeniero
    # - admin
    # - gestion
    # - superadmin
    # - inventario
    query = db.query(Tecnico).filter(
        Tecnico.tipo_usuario.in_(['tecnico', 'validacion'])
    ).order_by(Tecnico.nombre)
    
    api_logger.debug(f"[GET_TECNICOS] Filtro aplicado: tipo_usuario IN ('tecnico', 'validacion')")
    api_logger.debug(f"[GET_TECNICOS] Esto excluye automáticamente: asignaciones, ingeniero, admin, gestion, superadmin, inventario")
    
    items, total, pages = paginate_query(query, page, page_size)
    
    return PaginatedResponse(
        items=[TecnicoSchema.from_orm(tecnico) for tecnico in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

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
        numero_empleado=user_data.numero_empleado,
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
    user.numero_empleado = user_data.numero_empleado
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
    from ..models.models import (
        Validacion, Reparacion, JigNG, DamagedLabel, 
        SolicitudRegistro, AuditoriaPDF, Adaptador, ValidacionAdaptador, ConectorAdaptador
    )
    from ..utils.logger import get_logger
    
    logger = get_logger(__name__)
    
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
    
    try:
        # Eliminar o actualizar referencias antes de eliminar el usuario
        
        # 1. Eliminar damaged_labels asociados (reportado_por_id es NOT NULL)
        damaged_labels_count = db.query(DamagedLabel).filter(
            DamagedLabel.reportado_por_id == user_id
        ).count()
        if damaged_labels_count > 0:
            db.query(DamagedLabel).filter(
                DamagedLabel.reportado_por_id == user_id
            ).delete()
            logger.info(f"Eliminados {damaged_labels_count} damaged_labels asociados al usuario {user_id}")
        
        # 2. Actualizar validaciones (establecer tecnico_id y tecnico_asignado_id a NULL si es posible)
        # Nota: Si tecnico_id es NOT NULL, necesitamos eliminar las validaciones
        # Por ahora, eliminamos las validaciones donde el usuario es el técnico principal
        validaciones_count = db.query(Validacion).filter(
            Validacion.tecnico_id == user_id
        ).count()
        if validaciones_count > 0:
            db.query(Validacion).filter(
                Validacion.tecnico_id == user_id
            ).delete()
            logger.info(f"Eliminadas {validaciones_count} validaciones asociadas al usuario {user_id}")
        
        # Actualizar validaciones asignadas (tecnico_asignado_id puede ser NULL)
        db.query(Validacion).filter(
            Validacion.tecnico_asignado_id == user_id
        ).update({Validacion.tecnico_asignado_id: None})
        
        # 3. Eliminar reparaciones asociadas
        reparaciones_count = db.query(Reparacion).filter(
            Reparacion.tecnico_id == user_id
        ).count()
        if reparaciones_count > 0:
            db.query(Reparacion).filter(
                Reparacion.tecnico_id == user_id
            ).delete()
            logger.info(f"Eliminadas {reparaciones_count} reparaciones asociadas al usuario {user_id}")
        
        # 4. Actualizar JigNG (tecnico_reparacion_id puede ser NULL)
        db.query(JigNG).filter(
            JigNG.tecnico_reparacion_id == user_id
        ).update({JigNG.tecnico_reparacion_id: None})
        
        # Eliminar JigNG donde el usuario es el técnico principal
        jigs_ng_count = db.query(JigNG).filter(
            JigNG.tecnico_id == user_id
        ).count()
        if jigs_ng_count > 0:
            db.query(JigNG).filter(
                JigNG.tecnico_id == user_id
            ).delete()
            logger.info(f"Eliminados {jigs_ng_count} jigs_ng asociados al usuario {user_id}")
        
        # 5. Actualizar solicitudes_registro (admin_id puede ser NULL)
        db.query(SolicitudRegistro).filter(
            SolicitudRegistro.admin_id == user_id
        ).update({SolicitudRegistro.admin_id: None})
        
        # 6. Eliminar auditoria_pdfs asociados (tecnico_id es NOT NULL, así que debemos eliminarlos)
        auditoria_pdfs = db.query(AuditoriaPDF).filter(
            AuditoriaPDF.tecnico_id == user_id
        ).all()
        auditoria_pdfs_count = len(auditoria_pdfs)
        if auditoria_pdfs_count > 0:
            # Obtener rutas de archivos antes de eliminar
            from ..services.storage_service import cleanup_when_deleted_from_db
            for pdf in auditoria_pdfs:
                try:
                    cleanup_when_deleted_from_db(pdf)
                except Exception as e:
                    logger.warning(f"Error eliminando archivo PDF {pdf.ruta_archivo}: {e}")
            
            # Eliminar registros de la base de datos
            db.query(AuditoriaPDF).filter(
                AuditoriaPDF.tecnico_id == user_id
            ).delete()
            logger.info(f"Eliminados {auditoria_pdfs_count} PDFs de auditoría asociados al usuario {user_id}")
        
        # 7. Actualizar conectores_adaptador (los campos técnico están aquí, no en Adaptador)
        conectores_actualizados = db.query(ConectorAdaptador).filter(
            ConectorAdaptador.tecnico_ng_id == user_id
        ).update({ConectorAdaptador.tecnico_ng_id: None})
        
        if conectores_actualizados > 0:
            logger.info(f"Actualizados {conectores_actualizados} conectores_adaptador (tecnico_ng_id) asociados al usuario {user_id}")
        
        conectores_validacion_actualizados = db.query(ConectorAdaptador).filter(
            ConectorAdaptador.tecnico_ultima_validacion_id == user_id
        ).update({ConectorAdaptador.tecnico_ultima_validacion_id: None})
        
        if conectores_validacion_actualizados > 0:
            logger.info(f"Actualizados {conectores_validacion_actualizados} conectores_adaptador (tecnico_ultima_validacion_id) asociados al usuario {user_id}")
        
        # 8. Eliminar validaciones_adaptador asociadas
        validaciones_adaptador_count = db.query(ValidacionAdaptador).filter(
            ValidacionAdaptador.tecnico_id == user_id
        ).count()
        if validaciones_adaptador_count > 0:
            db.query(ValidacionAdaptador).filter(
                ValidacionAdaptador.tecnico_id == user_id
            ).delete()
            logger.info(f"Eliminadas {validaciones_adaptador_count} validaciones_adaptador asociadas al usuario {user_id}")
        
        # Ahora eliminar el usuario
        db.delete(user)
        db.commit()
        
        logger.info(f"Usuario {user.usuario} (ID: {user_id}) eliminado correctamente")
        
        return {
            "success": True,
            "message": "Usuario eliminado correctamente",
            "deleted_counts": {
                "damaged_labels": damaged_labels_count,
                "validaciones": validaciones_count,
                "reparaciones": reparaciones_count,
                "jigs_ng": jigs_ng_count,
                "auditoria_pdfs": auditoria_pdfs_count,
                "validaciones_adaptador": validaciones_adaptador_count
            }
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error eliminando usuario {user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando usuario: {str(e)}"
        )

@router.get("/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """Obtener estadísticas del sistema (solo administradores)"""
    total_users = db.query(Tecnico).count()
    pending_requests = db.query(SolicitudRegistro).filter(SolicitudRegistro.estado == "pendiente").count()
    
    # Contar usuarios admin reales de la base de datos
    # Contar usuarios con tipo_usuario == "admin" o usuarios en la lista ADMIN_USERS
    admin_count = db.query(Tecnico).filter(
        (Tecnico.tipo_usuario == "admin") | (Tecnico.usuario.in_(ADMIN_USERS))
    ).count()
    
    return {
        "total_users": total_users,
        "pending_requests": pending_requests,
        "admin_users": admin_count,  # Usar el conteo real en lugar de len(ADMIN_USERS)
        "current_admin": admin_user.usuario
    }

# ===== GESTIÓN DE SOLICITUDES DE REGISTRO =====

@router.get("/solicitudes", response_model=PaginatedResponse[SolicitudRegistroResponse])
async def get_solicitudes_registro(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """
    Obtener todas las solicitudes de registro con paginación (solo administradores)
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    """
    query = db.query(SolicitudRegistro).order_by(SolicitudRegistro.fecha_solicitud.desc())
    items, total, pages = paginate_query(query, page, page_size)
    
    return PaginatedResponse(
        items=[SolicitudRegistroResponse.from_orm(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/solicitudes/pendientes", response_model=PaginatedResponse[SolicitudRegistroResponse])
async def get_solicitudes_pendientes(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    db: Session = Depends(get_db),
    admin_user: Tecnico = Depends(verify_admin)
):
    """
    Obtener solo las solicitudes pendientes con paginación (solo administradores)
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    """
    query = db.query(SolicitudRegistro).filter(
        SolicitudRegistro.estado == "pendiente"
    ).order_by(SolicitudRegistro.fecha_solicitud.desc())
    
    items, total, pages = paginate_query(query, page, page_size)
    
    return PaginatedResponse(
        items=[SolicitudRegistroResponse.from_orm(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

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
            turno_actual=solicitud.turno_actual or "A",
            tipo_tecnico="Técnico de Instrumentación",
            tipo_usuario=solicitud.tipo_usuario or "tecnico"
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
