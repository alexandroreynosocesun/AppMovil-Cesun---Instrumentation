from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse
from sqlalchemy.orm import Session
from pathlib import Path
import uvicorn

from app.database import get_db, engine
from app.models import models
from app.routers import auth, jigs, validations, admin, jigs_ng, registro, damaged_labels, auditoria, storage, adaptadores, arduino_sequences, inventario
from app.config import CORS_ORIGINS, IS_PRODUCTION, FORCE_HTTPS, API_HOST, API_PORT
from app.utils.logger import get_logger
from app.services.monitoring_service import init_monitoring

# Configurar logging
logger = get_logger(__name__)

# Crear tablas de la base de datos
models.Base.metadata.create_all(bind=engine)

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

# Montar directorio de uploads para servir imágenes
uploads_dir = Path(__file__).parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

@app.get("/")
async def root():
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
