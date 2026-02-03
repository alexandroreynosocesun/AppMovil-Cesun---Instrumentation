"""
Configuración de la aplicación usando variables de entorno
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Entorno
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
IS_PRODUCTION = ENVIRONMENT.lower() == 'production'
IS_DEVELOPMENT = not IS_PRODUCTION

# API
API_HOST = os.getenv('API_HOST', '0.0.0.0')
API_PORT = int(os.getenv('API_PORT', 8000))
API_TITLE = os.getenv('API_TITLE', 'Hisense CheckApp')
API_VERSION = os.getenv('API_VERSION', '1.0.0')

# Seguridad
SECRET_KEY = os.getenv('SECRET_KEY', 'tu-clave-secreta-super-segura-aqui')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', 30))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', 30))

# CORS
CORS_ORIGINS_STR = os.getenv('CORS_ORIGINS', '*')
if CORS_ORIGINS_STR == '*' or IS_DEVELOPMENT:
    CORS_ORIGINS = ['*']  # Permitir todos en desarrollo
else:
    # En producción, parsear lista de orígenes
    CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_STR.split(',') if origin.strip()]

# Base de datos
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL debe estar configurado en el archivo .env. "
        "Ejemplo: postgresql+psycopg2://usuario:password@localhost:5432/jigs_validation"
    )

# Almacenamiento
REPORTS_DIR = os.getenv('REPORTS_DIR', 'reports')
ARCHIVE_DIR = os.getenv('ARCHIVE_DIR', 'reports/archived')
CLEANUP_DAYS = int(os.getenv('CLEANUP_DAYS', 365))
COMPRESS_DAYS = int(os.getenv('COMPRESS_DAYS', 180))
DISK_SPACE_WARNING_THRESHOLD = int(os.getenv('DISK_SPACE_WARNING_THRESHOLD', 85))
DISK_SPACE_CRITICAL_THRESHOLD = int(os.getenv('DISK_SPACE_CRITICAL_THRESHOLD', 95))

# Logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
LOG_TO_FILE = os.getenv('LOG_TO_FILE', 'false').lower() == 'true'
LOG_FILE_PATH = os.getenv('LOG_FILE_PATH', 'logs/app.log')

# SSL/TLS Configuration para producción
SSL_KEYFILE = os.getenv('SSL_KEYFILE', None)  # Ruta al archivo .key
SSL_CERTFILE = os.getenv('SSL_CERTFILE', None)  # Ruta al archivo .crt o .pem
FORCE_HTTPS = os.getenv('FORCE_HTTPS', 'false').lower() == 'true'  # Forzar HTTPS en producción

# Validaciones de seguridad para producción
if IS_PRODUCTION:
    # Verificar que SECRET_KEY no sea la default
    if SECRET_KEY == 'tu-clave-secreta-super-segura-aqui':
        raise ValueError(
            "⚠️ SECRET_KEY no puede ser la clave por defecto en producción. "
            "Genera una nueva usando: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
    
    # Advertencia si no hay SSL configurado
    if not SSL_KEYFILE or not SSL_CERTFILE:
        import warnings
        warnings.warn(
            "⚠️ ADVERTENCIA: Ejecutando en PRODUCCIÓN sin certificados SSL. "
            "Es altamente recomendado configurar HTTPS para proteger las contraseñas y datos sensibles. "
            "Configura SSL_KEYFILE y SSL_CERTFILE en tu archivo .env"
        )