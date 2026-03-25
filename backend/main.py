from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from pathlib import Path
import uvicorn

from app.database import get_db, engine
from app.models import models
from app.routers import auth, jigs, validations, admin, jigs_ng, registro, damaged_labels, auditoria, storage, adaptadores, arduino_sequences, inventario, seed, modelo_observaciones, hstvt, uph, cambios_hoy
from app.database_uph import uph_engine
from app.models import uph_models
from app.config import CORS_ORIGINS, IS_PRODUCTION, FORCE_HTTPS, API_HOST, API_PORT
from app.utils.logger import get_logger
from app.services.monitoring_service import init_monitoring

# Configurar logging
logger = get_logger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Crear tablas de la base de datos principal
models.Base.metadata.create_all(bind=engine)
# Crear tablas de la base de datos UPH
uph_models.UphBase.metadata.create_all(bind=uph_engine)

# Migración: agregar linea_uph a tecnicos si no existe
from app.database import engine as _main_engine
try:
    with _main_engine.connect() as _conn:
        try:
            _conn.execute(_text("ALTER TABLE tecnicos ADD COLUMN linea_uph VARCHAR(20)"))
            _conn.commit()
        except Exception:
            _conn.rollback()
except Exception:
    pass

# Migración: agregar columnas nuevas a modelos_uph si no existen
from sqlalchemy import text as _text
from app.database_uph import UphSessionLocal as _UphSession
try:
    with uph_engine.connect() as _conn:
        # Hacer linea_id nullable
        try:
            _conn.execute(_text("ALTER TABLE modelos_uph ALTER COLUMN linea_id DROP NOT NULL"))
            _conn.commit()
        except Exception:
            _conn.rollback()
        # Agregar num_placa
        try:
            _conn.execute(_text("ALTER TABLE modelos_uph ADD COLUMN num_placa VARCHAR"))
            _conn.commit()
        except Exception:
            _conn.rollback()
        # Agregar modelo_interno
        try:
            _conn.execute(_text("ALTER TABLE modelos_uph ADD COLUMN modelo_interno VARCHAR"))
            _conn.commit()
        except Exception:
            _conn.rollback()
        # Agregar turno a operadores
        try:
            _conn.execute(_text("ALTER TABLE operadores ADD COLUMN turno VARCHAR"))
            _conn.commit()
        except Exception:
            _conn.rollback()
except Exception as _e:
    pass

# Seed líneas HI-1 a HI-6 y turnos A/B/C
from app.routers.uph import seed_lineas as _seed_lineas
from app.models.uph_models import Turno as _Turno
try:
    _db = _UphSession()
    _seed_lineas(_db)
    # Seed turnos A, B, C si no existen
    _turnos_default = [
        {"nombre": "A", "hora_inicio": "06:00", "hora_fin": "18:00", "dias": "Lunes-Sábado"},
        {"nombre": "B", "hora_inicio": "18:00", "hora_fin": "06:00", "dias": "Lunes-Sábado"},
        {"nombre": "C", "hora_inicio": "08:00", "hora_fin": "20:00", "dias": "Lunes-Viernes"},
    ]
    for _td in _turnos_default:
        if not _db.query(_Turno).filter(_Turno.nombre == _td["nombre"]).first():
            _db.add(_Turno(**_td))
    _db.commit()
    _db.close()
except Exception as _e:
    pass

app = FastAPI(
    title="Hisense CheckApp",
    description="""
    ## API para digitalizar validaciones de jigs
    
    Esta API permite gestionar el sistema completo de validación de jigs, incluyendo:
    
    * **Autenticación**: Login y gestión de usuarios
    * **Jigs**: Gestión de jigs y sus códigos QR
    * **Validaciones**: Creación y consulta de validaciones
    * **Auditoría**: Generación y consulta de PDFs de auditoría
    * **Administración**: Gestión de usuarios y solicitudes
    
    ## Características
    
    * Paginación en todos los endpoints de listado
    * Autenticación basada en JWT
    * Documentación interactiva con Swagger UI
    * Migraciones de base de datos con Alembic
    
    ## Autenticación
    
    Todos los endpoints protegidos requieren un token JWT que se obtiene mediante el endpoint `/api/auth/login`.
    
    Para usar los endpoints protegidos, incluye el token en el header:
    ```
    Authorization: Bearer <tu_token>
    ```
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    terms_of_service="https://example.com/terms/",
    contact={
        "name": "Soporte API",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
    },
)

# Inicializar monitoreo (Prometheus y Sentry)
init_monitoring(app)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware para forzar HTTPS en producción
if IS_PRODUCTION and FORCE_HTTPS:
    class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            # Verificar si la petición viene por HTTP
            if request.url.scheme == "http":
                # Redirigir a HTTPS
                https_url = request.url.replace(scheme="https")
                return RedirectResponse(url=str(https_url), status_code=301)
            return await call_next(request)
    
    app.add_middleware(HTTPSRedirectMiddleware)
    logger.info("🔒 Middleware de redirección HTTP a HTTPS activado")

# Configurar CORS basado en variables de entorno
cors_origins = CORS_ORIGINS if CORS_ORIGINS else ["*"]
if IS_PRODUCTION and "*" in cors_origins:
    logger.warning("⚠️ CORS configurado con '*' en producción. Esto es inseguro. Especifica dominios exactos.")
    cors_origins = []  # En producción, no permitir * por defecto

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"🚀 Aplicación iniciada en modo: {'PRODUCCIÓN' if IS_PRODUCTION else 'DESARROLLO'}")
logger.info(f"🌐 CORS configurado para orígenes: {cors_origins if cors_origins else 'NINGUNO (solo mismo origen)'}")

# Incluir routers
app.include_router(auth.router, prefix="/api/auth", tags=["autenticación"])
app.include_router(jigs.router, prefix="/api/jigs", tags=["jigs"])
app.include_router(validations.router, prefix="/api/validations", tags=["validaciones"])
app.include_router(admin.router, prefix="/api/admin", tags=["administración"])
app.include_router(jigs_ng.router, prefix="/api/jigs-ng", tags=["jigs-ng"])
app.include_router(registro.router, prefix="/api/registro", tags=["registro"])
app.include_router(damaged_labels.router, prefix="/api", tags=["damaged-labels"])
app.include_router(auditoria.router, prefix="/api/auditoria", tags=["auditoria"])
app.include_router(storage.router, prefix="/api/storage", tags=["storage"])
app.include_router(adaptadores.router, prefix="/api/adaptadores", tags=["adaptadores"])
app.include_router(arduino_sequences.router, prefix="/api/arduino-sequences", tags=["arduino-sequences"])
app.include_router(inventario.router, prefix="/api/inventario", tags=["inventario"])
app.include_router(seed.router, prefix="/api/seed", tags=["seed"])
app.include_router(modelo_observaciones.router, prefix="/api/modelo-observaciones", tags=["modelo-observaciones"])
app.include_router(hstvt.router, prefix="/api/hstvt", tags=["hstvt"])
app.include_router(uph.router, prefix="/api/uph", tags=["uph"])
app.include_router(cambios_hoy.router)

# Montar directorio de uploads para servir imágenes
uploads_dir = Path(__file__).parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

@app.get("/")
@limiter.limit("10/minute")
async def root(request: Request):
    return {"message": "Hisense CheckApp API"}

@app.get("/health")
async def health_check():
    """Health check básico"""
    from app.services.cache_service import cache_service
    from app.database import engine
    from sqlalchemy import text

    health_status = {
        "status": "ok",
        "message": "API funcionando correctamente",
        "database": "connected",
        "cache": "enabled" if cache_service.enabled else "disabled"
    }

    # Verificar conexión a base de datos
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        health_status["database"] = "disconnected"
        health_status["status"] = "degraded"
        health_status["database_error"] = str(e)

    return health_status

@app.get("/api/health")
async def api_health_check():
    """Health check detallado para API"""
    from app.services.cache_service import cache_service
    from app.database import engine
    from sqlalchemy import text
    import time

    checks = {
        "api": "ok",
        "database": "checking",
        "cache": "checking"
    }

    # Verificar base de datos
    try:
        start = time.time()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_time = time.time() - start
        checks["database"] = "ok"
        checks["database_response_time"] = f"{db_time:.3f}s"
    except Exception as e:
        checks["database"] = "error"
        checks["database_error"] = str(e)
    
    # Verificar caché
    if cache_service.enabled:
        try:
            cache_service.redis_client.ping()
            checks["cache"] = "ok"
        except Exception as e:
            checks["cache"] = "error"
            checks["cache_error"] = str(e)
    else:
        checks["cache"] = "disabled"
    
    overall_status = "ok" if all(v in ["ok", "disabled"] for v in checks.values()) else "degraded"
    
    return {
        "status": overall_status,
        "checks": checks,
        "timestamp": time.time()
    }

# Iniciar tareas programadas de limpieza
try:
    from app.tasks.cleanup_task import start_cleanup_scheduler
    start_cleanup_scheduler()
    logger.info("✅ Programador de limpieza automática iniciado")
except Exception as e:
    logger.error(f"No se pudo iniciar el programador de limpieza: {e}", exc_info=True)

if __name__ == "__main__":
    logger.info(f"Iniciando servidor en {API_HOST}:{API_PORT} (Entorno: {'PRODUCCIÓN' if IS_PRODUCTION else 'DESARROLLO'})")
    uvicorn.run(app, host=API_HOST, port=API_PORT)
