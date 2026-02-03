from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from ..database import get_db
from ..models.models import Tecnico, SolicitudRegistro
from ..schemas import TecnicoCreate, TecnicoLogin, Token, Tecnico as TecnicoSchema, TecnicoUpdate, SolicitudRegistroCreate, SolicitudRegistroResponse
from ..auth import authenticate_user, create_access_token, create_refresh_token, verify_refresh_token, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.post("/login", response_model=Token, summary="Iniciar sesión", description="""
    Iniciar sesión con usuario y contraseña.
    
    Retorna un token JWT que debe ser usado en el header `Authorization: Bearer <token>` 
    para acceder a los endpoints protegidos.
    
    **Ejemplo de uso:**
    ```json
    {
        "usuario": "tu_usuario",
        "password": "tu_contraseña"
    }
    ```
    
    **Respuesta:**
    - `access_token`: Token JWT para autenticación
    - `token_type`: Tipo de token (siempre "bearer")
    - `tecnico`: Información del técnico autenticado
    """)
async def login(login_data: TecnicoLogin, db: Session = Depends(get_db)):
    """Iniciar sesión de técnico"""
    user = authenticate_user(db, login_data.usuario, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.usuario}, expires_delta=access_token_expires
    )
    
    # Crear refresh token
    refresh_token = create_refresh_token(data={"sub": user.usuario})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "tecnico": TecnicoSchema.model_validate(user)
    }

@router.post("/refresh", response_model=dict, summary="Renovar access token", description="""
    Renovar el access token usando un refresh token válido.
    
    **Ejemplo de uso:**
    ```json
    {
        "refresh_token": "tu_refresh_token_aqui"
    }
    ```
    
    **Respuesta:**
    - `access_token`: Nuevo token de acceso
    - `token_type`: Tipo de token (siempre "bearer")
    """)
async def refresh_access_token(refresh_data: dict, db: Session = Depends(get_db)):
    """Obtener nuevo access token usando refresh token"""
    refresh_token = refresh_data.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token requerido"
        )
    
    usuario = verify_refresh_token(refresh_token)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verificar que el usuario aún existe
    user = db.query(Tecnico).filter(Tecnico.usuario == usuario).first()
    if not user or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Crear nuevo access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": usuario}, expires_delta=access_token_expires
    )
    
    logger.info(f"✅ Access token renovado para usuario '{usuario}'")
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }

@router.get("/users-for-login")
async def get_users_for_login(db: Session = Depends(get_db)):
    """
    Obtener lista de usuarios para el selector de login (público, sin autenticación)
    Retorna solo usuario y nombre para selección
    """
    try:
        # Obtener todos los usuarios activos, ordenados por nombre
        users = db.query(Tecnico).filter(Tecnico.activo == True).order_by(Tecnico.nombre).all()
        
        # Retornar solo información básica (usuario y nombre)
        users_list = [
            {
                "usuario": user.usuario,
                "nombre": user.nombre,
                "numero_empleado": user.numero_empleado
            }
            for user in users
        ]
        
        return {
            "users": users_list,
            "total": len(users_list)
        }
    except Exception as e:
        logger.error(f"Error obteniendo usuarios para login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener lista de usuarios"
        )

@router.post("/register", response_model=SolicitudRegistroResponse)
async def register(solicitud_data: SolicitudRegistroCreate, db: Session = Depends(get_db)):
    """Crear solicitud de registro"""
    # Verificar si el usuario ya existe
    existing_user = db.query(Tecnico).filter(Tecnico.usuario == solicitud_data.usuario).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya existe"
        )
    
    # Verificar si ya hay una solicitud pendiente
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
    
    # Verificar solicitud con mismo número de empleado (cualquier estado)
    # El índice único aplica a todas las solicitudes, no solo las pendientes
    existing_solicitud_employee = db.query(SolicitudRegistro).filter(
        SolicitudRegistro.numero_empleado == solicitud_data.numero_empleado
    ).first()
    
    if existing_solicitud_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una solicitud ({existing_solicitud_employee.estado}) para este número de empleado"
        )
    
    # Crear solicitud de registro
    # Mapear valores del frontend al backend
    # El frontend ya envía 'ingeniero' cuando se selecciona 'asignaciones'
    tipo_usuario_map = {
        'ingeniero': 'ingeniero',  # El frontend envía 'ingeniero' cuando se selecciona 'asignaciones'
        'tecnico': 'tecnico',  # El frontend envía 'tecnico' cuando se selecciona 'validaciones'
        'gestion': 'gestion',
        # Compatibilidad: si llega 'asignaciones' directamente, mapearlo a 'ingeniero'
        'asignaciones': 'ingeniero'
    }
    tipo_usuario_backend = tipo_usuario_map.get(solicitud_data.tipo_usuario, 'tecnico')
    
    try:
        logger.info(f"🔧 Mapeo tipo_usuario: '{solicitud_data.tipo_usuario}' -> '{tipo_usuario_backend}'")
    except Exception:
        pass
    
    hashed_password = get_password_hash(solicitud_data.password)
    db_solicitud = SolicitudRegistro(
        usuario=solicitud_data.usuario,
        nombre=solicitud_data.nombre,
        numero_empleado=solicitud_data.numero_empleado,
        password_hash=hashed_password,
        tipo_usuario=tipo_usuario_backend,
        turno_actual=solicitud_data.turno_actual or "A",
        firma_digital=solicitud_data.firma_digital
    )
    
    db.add(db_solicitud)
    
    try:
        db.commit()
        db.refresh(db_solicitud)
    except Exception as commit_error:
        error_str = str(commit_error)
        # Si es un error de llave duplicada, intentar corregir la secuencia y reintentar
        if "UniqueViolation" in error_str and "solicitudes_registro_pkey" in error_str:
            from sqlalchemy import text
            logger.warning("⚠️ Error de llave duplicada detectado en solicitudes_registro. Corrigiendo secuencia...")
            try:
                db.rollback()  # Rollback de la transacción actual
                
                # Obtener el máximo ID actual
                max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM solicitudes_registro"))
                max_id = max_id_result.scalar()
                
                # Actualizar la secuencia al siguiente valor disponible
                db.execute(text(f"SELECT setval('solicitudes_registro_id_seq', {max_id}, true)"))
                db.commit()
                logger.info(f"✅ Secuencia solicitudes_registro_id_seq corregida a {max_id + 1}. Reintentando crear solicitud...")
                
                # Recrear la solicitud con la secuencia corregida
                db_solicitud = SolicitudRegistro(
                    usuario=solicitud_data.usuario,
                    nombre=solicitud_data.nombre,
                    numero_empleado=solicitud_data.numero_empleado,
                    password_hash=hashed_password,
                    tipo_usuario=tipo_usuario_backend,
                    turno_actual=solicitud_data.turno_actual or "A",
                    firma_digital=solicitud_data.firma_digital
                )
                db.add(db_solicitud)
                
                # Reintentar el commit
                db.commit()
                db.refresh(db_solicitud)
                logger.info("✅ Solicitud creada exitosamente después de corregir secuencia")
            except Exception as retry_error:
                logger.error(f"❌ Error al reintentar después de corregir secuencia: {retry_error}")
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error creando solicitud después de corregir secuencia: {str(retry_error)}"
                )
        else:
            # Si es otro tipo de error, hacer rollback y relanzar
            db.rollback()
            logger.error(f"❌ Error creando solicitud de registro: {commit_error}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creando solicitud de registro: {str(commit_error)}"
            )
    
    try:
        return SolicitudRegistroResponse.from_orm(db_solicitud)
    except Exception as response_error:
        logger.error(f"❌ Error creando respuesta: {response_error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando respuesta: {str(response_error)}"
        )

@router.get("/me", response_model=TecnicoSchema)
async def read_users_me(current_user: Tecnico = Depends(get_current_user)):
    """Obtener información del usuario actual"""
    return TecnicoSchema.model_validate(current_user)

@router.post("/test-update")
async def test_update_profile(
    update_data: dict,
    current_user: Tecnico = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Endpoint de prueba para actualizar perfil"""
    try:
        print(f"TEST - Datos recibidos: {update_data}")
        print(f"TEST - Usuario actual: {current_user.nombre}, turno: {current_user.turno_actual}")
        
        if "turno_actual" in update_data:
            turno_nuevo = update_data["turno_actual"]
            print(f"TEST - Cambiando turno de '{current_user.turno_actual}' a '{turno_nuevo}'")
            current_user.turno_actual = turno_nuevo
            db.commit()
            db.refresh(current_user)
            print(f"TEST - Turno actualizado exitosamente a: {current_user.turno_actual}")
        
        return {
            "success": True,
            "message": "Perfil actualizado exitosamente",
            "user": TecnicoSchema.model_validate(current_user)
        }
    except Exception as e:
        print(f"TEST - Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@router.get("/solicitud/{usuario}", response_model=SolicitudRegistroResponse)
async def get_solicitud_status(usuario: str, db: Session = Depends(get_db)):
    """Obtener el estado de una solicitud de registro por nombre de usuario"""
    solicitud = db.query(SolicitudRegistro).filter(SolicitudRegistro.usuario == usuario).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada"
        )
    return solicitud

@router.put("/me", response_model=TecnicoSchema)
async def update_user_profile(
    update_data: dict,
    current_user: Tecnico = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualizar perfil del usuario"""
    try:
        print(f"Datos recibidos para actualización: {update_data}")
        
        # Usar directamente el diccionario recibido
        update_dict = update_data
        print(f"Campos a actualizar: {update_dict}")
        
        # Verificar que al menos un campo sea proporcionado
        if not update_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se proporcionaron campos para actualizar"
            )
        
        # Actualizar nombre
        if "nombre" in update_dict and update_dict["nombre"]:
            current_user.nombre = update_dict["nombre"]
            print(f"Nombre actualizado a: {current_user.nombre}")
        
        # Actualizar número de empleado
        if "numero_empleado" in update_dict and update_dict["numero_empleado"]:
            # Verificar que el número de empleado no esté en uso
            existing_employee = db.query(Tecnico).filter(
                Tecnico.numero_empleado == update_dict["numero_empleado"],
                Tecnico.id != current_user.id
            ).first()
            if existing_employee:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El número de empleado ya está en uso"
                )
            current_user.numero_empleado = update_dict["numero_empleado"]
            print(f"Número de empleado actualizado a: {current_user.numero_empleado}")
        
        # Actualizar contraseña
        if "password" in update_dict and update_dict["password"]:
            current_user.password_hash = get_password_hash(update_dict["password"])
            print("Contraseña actualizada")
        
        # Actualizar firma digital
        if "firma_digital" in update_dict and update_dict["firma_digital"]:
            current_user.firma_digital = update_dict["firma_digital"]
            print("Firma digital actualizada")
        
        # Actualizar turno actual
        if "turno_actual" in update_dict and update_dict["turno_actual"]:
            turno_nuevo = update_dict["turno_actual"]
            # Validar que el turno sea válido
            turnos_validos = ['A', 'B', 'C', 'mañana', 'noche', 'fines']
            if turno_nuevo not in turnos_validos:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Turno inválido. Debe ser uno de: {', '.join(turnos_validos)}"
                )
            print(f"Actualizando turno de '{current_user.turno_actual}' a '{turno_nuevo}'")
            current_user.turno_actual = turno_nuevo
            print(f"Turno actualizado a: {current_user.turno_actual}")
        
        # Guardar cambios en la base de datos
        db.commit()
        db.refresh(current_user)
        print(f"Usuario actualizado exitosamente - turno final: {current_user.turno_actual}")
        
        return TecnicoSchema.model_validate(current_user)
        
    except HTTPException:
        # Re-lanzar excepciones HTTP (como errores de validación)
        raise
    except Exception as e:
        # Manejar otros errores
        db.rollback()
        print(f"Error al actualizar usuario: {str(e)}")
        print(f"Tipo de error: {type(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )
