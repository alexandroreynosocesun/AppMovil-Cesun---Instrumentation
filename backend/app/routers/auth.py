from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from ..database import get_db
from ..models.models import Tecnico, SolicitudRegistro
from ..schemas import TecnicoCreate, TecnicoLogin, Token, Tecnico as TecnicoSchema, TecnicoUpdate, SolicitudRegistroCreate, SolicitudRegistroResponse
from ..auth import authenticate_user, create_access_token, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user

router = APIRouter()

@router.post("/login", response_model=Token)
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
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "tecnico": TecnicoSchema.model_validate(user)
    }

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
    
    # Crear solicitud de registro
    hashed_password = get_password_hash(solicitud_data.password)
    db_solicitud = SolicitudRegistro(
        usuario=solicitud_data.usuario,
        nombre=solicitud_data.nombre,
        numero_empleado=solicitud_data.numero_empleado,
        password_hash=hashed_password,
        firma_digital=solicitud_data.firma_digital
    )
    
    db.add(db_solicitud)
    db.commit()
    db.refresh(db_solicitud)
    
    return SolicitudRegistroResponse.from_orm(db_solicitud)

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
