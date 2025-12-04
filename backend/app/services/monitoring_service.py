"""
Servicio de monitoreo y alertas
Integra Prometheus para métricas y Sentry para tracking de errores
"""
import os
import time
import logging
from functools import wraps
from typing import Callable
from fastapi import Request, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response as StarletteResponse
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

logger = logging.getLogger(__name__)

# Métricas de Prometheus
http_requests_total = Counter(
    'http_requests_total',
    'Total de peticiones HTTP',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'Duración de peticiones HTTP en segundos',
    ['method', 'endpoint']
)

active_connections = Gauge(
    'active_connections',
    'Conexiones activas'
)

database_queries_total = Counter(
    'database_queries_total',
    'Total de consultas a la base de datos',
    ['operation', 'table']
)

cache_hits_total = Counter(
    'cache_hits_total',
    'Total de hits en caché',
    ['cache_key']
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Total de misses en caché',
    ['cache_key']
)

def init_sentry():
    """Inicializar Sentry para tracking de errores"""
    sentry_dsn = os.getenv("SENTRY_DSN")
    if not sentry_dsn:
        logger.info("Sentry no configurado (SENTRY_DSN no encontrado)")
        return
    
    sentry_environment = os.getenv("SENTRY_ENVIRONMENT", "development")
    traces_sample_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=sentry_environment,
        traces_sample_rate=traces_sample_rate,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        # Configuración adicional
        before_send=lambda event, hint: event,  # Puedes filtrar eventos aquí
    )
    
    logger.info(f"✅ Sentry inicializado para ambiente: {sentry_environment}")

def init_monitoring(app):
    """Inicializar monitoreo en la aplicación FastAPI"""
    # Inicializar Sentry
    init_sentry()
    
    # Middleware para métricas HTTP
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next: Callable):
        start_time = time.time()
        
        # Incrementar conexiones activas
        active_connections.inc()
        
        try:
            response = await call_next(request)
            
            # Registrar métricas
            duration = time.time() - start_time
            endpoint = request.url.path
            method = request.method
            status = response.status_code
            
            http_requests_total.labels(method=method, endpoint=endpoint, status=status).inc()
            http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)
            
            return response
        except Exception as e:
            # Registrar error en Sentry
            sentry_sdk.capture_exception(e)
            raise
        finally:
            # Decrementar conexiones activas
            active_connections.dec()
    
    # Endpoint para métricas de Prometheus
    @app.get("/metrics")
    async def metrics():
        """Endpoint para métricas de Prometheus"""
        return StarletteResponse(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )
    
    logger.info("✅ Monitoreo inicializado")

def track_database_query(operation: str, table: str):
    """Registrar una consulta a la base de datos"""
    database_queries_total.labels(operation=operation, table=table).inc()

def track_cache_hit(cache_key: str):
    """Registrar un hit en caché"""
    cache_hits_total.labels(cache_key=cache_key).inc()

def track_cache_miss(cache_key: str):
    """Registrar un miss en caché"""
    cache_misses_total.labels(cache_key=cache_key).inc()

def monitor_function(func_name: str = None):
    """
    Decorador para monitorear funciones
    Registra tiempo de ejecución y errores
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            name = func_name or func.__name__
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                logger.debug(f"Función {name} ejecutada en {duration:.2f}s")
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Error en función {name} después de {duration:.2f}s: {e}")
                sentry_sdk.capture_exception(e)
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            name = func_name or func.__name__
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                logger.debug(f"Función {name} ejecutada en {duration:.2f}s")
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Error en función {name} después de {duration:.2f}s: {e}")
                sentry_sdk.capture_exception(e)
                raise
        
        # Retornar el wrapper apropiado según si la función es async
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

