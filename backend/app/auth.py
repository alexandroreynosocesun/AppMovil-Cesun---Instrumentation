from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models.models import Tecnico
from .schemas import Token
from .utils.logger import auth_logger

# Configuración de seguridad
from app.config import SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS

ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar contraseña"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generar hash de contraseña"""
    return pwd_context.hash(password)

def authenticate_user(db: Session, usuario: str, password: str) -> Optional[Tecnico]:
    """Autenticar usuario"""
    user = db.query(Tecnico).filter(Tecnico.usuario == usuario).first()
    if not user:
        auth_logger.warning(f"Intento de login fallido: usuario '{usuario}' no encontrado")
        return None
    if not verify_password(password, user.password_hash):
        auth_logger.warning(f"Intento de login fallido: contraseña incorrecta para usuario '{usuario}'")
        return None
    auth_logger.info(f"Login exitoso para usuario '{usuario}'")
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crear token de acceso"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """Crear refresh token (larga duración)"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_refresh_token(token: str) -> Optional[str]:
    """Verificar refresh token y retornar el nombre de usuario"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            auth_logger.warning("Token no es de tipo refresh")
            return None
        usuario: str = payload.get("sub")
        return usuario
    except JWTError as e:
        auth_logger.warning(f"Error decodificando refresh token: {e}")
        return None

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Obtener usuario actual desde token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario: str = payload.get("sub")
        if usuario is None:
            auth_logger.warning("Token JWT inválido: usuario no encontrado en payload")
            raise credentials_exception
    except JWTError as e:
        auth_logger.warning(f"Error decodificando token JWT: {e}")
        raise credentials_exception
    
    user = db.query(Tecnico).filter(Tecnico.usuario == usuario).first()
    if user is None:
        auth_logger.warning(f"Usuario '{usuario}' no encontrado en BD después de validar token")
        raise credentials_exception
    return user
