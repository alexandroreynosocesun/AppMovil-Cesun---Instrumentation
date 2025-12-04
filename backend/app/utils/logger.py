"""
Sistema de logging estructurado para la aplicación
"""
import logging
import sys
import os
from datetime import datetime
from pathlib import Path
from app.config import IS_PRODUCTION, LOG_LEVEL, LOG_TO_FILE, LOG_FILE_PATH

class ColoredFormatter(logging.Formatter):
    """Formatter con colores para la consola"""
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'
    }

    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        record.levelname = f"{log_color}{record.levelname}{self.COLORS['RESET']}"
        return super().format(record)

class StructuredFormatter(logging.Formatter):
    """Formatter estructurado para producción"""
    
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'message': record.getMessage()
        }
        
        # Agregar información adicional si existe
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Formato JSON para producción, formato legible para desarrollo
        if IS_PRODUCTION:
            import json
            return json.dumps(log_data)
        else:
            return f"[{log_data['timestamp']}] {log_data['level']} | {log_data['module']}.{log_data['function']}:{log_data['line']} | {log_data['message']}"

def setup_logger(name: str = 'app') -> logging.Logger:
    """
    Configurar logger con formato apropiado según el entorno
    
    Args:
        name: Nombre del logger
    
    Returns:
        Logger configurado
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    
    # Evitar duplicar handlers
    if logger.handlers:
        return logger
    
    # Handler para consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    
    if IS_PRODUCTION:
        # En producción: formato estructurado (JSON)
        console_handler.setFormatter(StructuredFormatter())
    else:
        # En desarrollo: formato con colores
        console_handler.setFormatter(ColoredFormatter(
            '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
    
    logger.addHandler(console_handler)
    
    # Handler para archivo (si está habilitado)
    if LOG_TO_FILE:
        log_path = Path(LOG_FILE_PATH)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_path, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(StructuredFormatter())
        logger.addHandler(file_handler)
    
    return logger

def get_logger(name: str = None) -> logging.Logger:
    """
    Obtener o crear un logger (alias de setup_logger para compatibilidad)
    
    Args:
        name: Nombre del logger (opcional, usa __name__ del módulo si no se proporciona)
    
    Returns:
        Logger configurado
    """
    if name is None:
        import inspect
        frame = inspect.currentframe().f_back
        name = frame.f_globals.get('__name__', 'app')
    return setup_logger(name)

# Logger principal
logger = setup_logger('app')

# Loggers específicos
api_logger = setup_logger('app.api')
db_logger = setup_logger('app.database')
storage_logger = setup_logger('app.storage')
auth_logger = setup_logger('app.auth')
