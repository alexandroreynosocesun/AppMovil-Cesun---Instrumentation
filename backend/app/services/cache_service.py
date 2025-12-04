"""
Servicio de caché usando Redis
Proporciona funciones para almacenar y recuperar datos en caché
"""
import redis
import json
import os
from typing import Optional, Any
from functools import wraps
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class CacheService:
    """Servicio para manejar caché con Redis"""
    
    def __init__(self):
        self.redis_client = None
        self.enabled = False
        self._connect()
    
    def _connect(self):
        """Conectar a Redis"""
        try:
            redis_url = os.getenv("REDIS_URL")
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            redis_db = int(os.getenv("REDIS_DB", 0))
            redis_password = os.getenv("REDIS_PASSWORD")
            
            if redis_url:
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            else:
                self.redis_client = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    password=redis_password if redis_password else None,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            
            # Verificar conexión
            self.redis_client.ping()
            self.enabled = True
            logger.info("✅ Redis conectado correctamente")
        except Exception as e:
            logger.warning(f"⚠️ Redis no disponible: {e}. Continuando sin caché.")
            self.enabled = False
            self.redis_client = None
    
    def get(self, key: str) -> Optional[Any]:
        """Obtener valor del caché"""
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Error obteniendo del caché: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Almacenar valor en caché con TTL en segundos"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error(f"Error guardando en caché: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Eliminar clave del caché"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error eliminando del caché: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Eliminar todas las claves que coincidan con el patrón"""
        if not self.enabled or not self.redis_client:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Error eliminando patrón del caché: {e}")
            return 0
    
    def clear(self) -> bool:
        """Limpiar todo el caché"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            self.redis_client.flushdb()
            return True
        except Exception as e:
            logger.error(f"Error limpiando caché: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Verificar si una clave existe"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            return self.redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Error verificando existencia en caché: {e}")
            return False

# Instancia global del servicio de caché
cache_service = CacheService()

def cached(ttl: int = 3600, key_prefix: str = ""):
    """
    Decorador para cachear resultados de funciones
    
    Args:
        ttl: Tiempo de vida del caché en segundos (default: 1 hora)
        key_prefix: Prefijo para la clave del caché
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generar clave única basada en función y argumentos
            cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Intentar obtener del caché
            cached_result = cache_service.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_result
            
            # Ejecutar función y guardar resultado
            logger.debug(f"Cache miss: {cache_key}")
            result = await func(*args, **kwargs) if hasattr(func, '__call__') else func(*args, **kwargs)
            
            # Guardar en caché
            cache_service.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

