"""
Tarea programada para limpieza automática de PDFs y validaciones
Se ejecuta periódicamente para mantener el almacenamiento optimizado
y eliminar validaciones al finalizar turnos
"""
import schedule
import time
import threading
from datetime import datetime, timedelta
import sys
import os

# Agregar el directorio raíz al path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database import SessionLocal
from app.models.models import Validacion
from app.services.storage_service import (
    cleanup_old_pdfs,
    compress_old_pdfs,
    get_storage_status,
    DISK_SPACE_WARNING_THRESHOLD
)
from app.utils.logger import storage_logger
from app.utils.logger import get_logger

logger = get_logger(__name__)

def run_cleanup_task():
    """Ejecutar tarea de limpieza automática"""
    db = SessionLocal()
    try:
        storage_logger.info("Iniciando limpieza automática de PDFs")
        
        # Verificar estado del almacenamiento
        status = get_storage_status()
        
        # Si el disco está por llenarse, limpiar PDFs más agresivamente
        if status['disk_usage']['percent_used'] >= DISK_SPACE_WARNING_THRESHOLD:
            storage_logger.warning(f"Disco casi lleno ({status['disk_usage']['percent_used']}%), limpiando PDFs antiguos...")
            cleanup_result = cleanup_old_pdfs(db, days=180)  # 6 meses en lugar de 1 año
            storage_logger.info(f"Limpieza agresiva: {cleanup_result['deleted_files']} archivos, {cleanup_result['freed_space_mb']} MB liberados")
        
        # Comprimir PDFs antiguos (6 meses)
        storage_logger.info("Comprimiendo PDFs antiguos...")
        compress_result = compress_old_pdfs(db, days=180)
        storage_logger.info(f"Compresión: {compress_result['compressed_files']} archivos, {compress_result['saved_space_mb']} MB ahorrados")
        
        # Limpieza normal (1 año)
        storage_logger.info("Limpiando PDFs muy antiguos...")
        cleanup_result = cleanup_old_pdfs(db, days=365)
        storage_logger.info(f"Limpieza normal: {cleanup_result['deleted_files']} archivos, {cleanup_result['freed_space_mb']} MB liberados")
        
        storage_logger.info("Limpieza automática completada")
        
    except Exception as e:
        storage_logger.error(f"Error en limpieza automática: {e}", exc_info=True)
    finally:
        db.close()

def cleanup_turn_validations(turno: str):
    """
    Eliminar validaciones al finalizar un turno
    Elimina TODAS las validaciones del turno (asignadas y no asignadas, completadas y pendientes)
    
    Args:
        turno: 'A' o 'B'
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        
        # Determinar la fecha del turno que está terminando
        # Turno A: 6:30 AM - 6:30 PM (se elimina a las 6:30 PM)
        # Turno B: 6:30 PM - 6:30 AM (se elimina a las 6:30 AM)
        
        if turno == 'A':
            # Turno A termina a las 6:30 PM
            # Eliminar validaciones del turno A del día actual
            target_date = now.date()
            logger.info(f"🧹 Limpiando validaciones del Turno A del {target_date} (incluyendo asignadas)")
        else:  # turno == 'B'
            # Turno B termina a las 6:30 AM
            # Eliminar validaciones del turno B que empezó ayer (porque cruza medianoche)
            target_date = (now - timedelta(days=1)).date()
            logger.info(f"🧹 Limpiando validaciones del Turno B del {target_date} (incluyendo asignadas)")
        
        # Buscar validaciones del turno y fecha específica
        # Eliminar TODAS las validaciones del turno:
        # - Completadas y pendientes
        # - Asignadas y no asignadas (tecnico_asignado_id puede ser NULL o tener valor)
        # Filtrar por fecha: desde el inicio del día hasta el final del día
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time()) + timedelta(days=1)
        
        # Contar antes de eliminar para logging
        count_before = db.query(Validacion).filter(
            Validacion.turno == turno,
            Validacion.fecha >= start_datetime,
            Validacion.fecha < end_datetime
        ).count()
        
        # Eliminar todas las validaciones del turno (sin filtrar por tecnico_asignado_id o completada)
        deleted_count = db.query(Validacion).filter(
            Validacion.turno == turno,
            Validacion.fecha >= start_datetime,
            Validacion.fecha < end_datetime
        ).delete()
        
        db.commit()
        
        logger.info(f"✅ Eliminadas {deleted_count} validaciones del Turno {turno} del {target_date} (contadas: {count_before})")
        logger.info(f"   - Esto incluye todas las validaciones asignadas y no asignadas del turno")
        return deleted_count
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error eliminando validaciones del turno {turno}: {e}", exc_info=True)
        return 0
    finally:
        db.close()

def run_turn_cleanup():
    """Ejecutar limpieza de validaciones al finalizar turnos"""
    now = datetime.utcnow()
    current_hour = now.hour
    current_minute = now.minute
    
    # Turno A termina a las 6:30 PM (18:30)
    if current_hour == 18 and current_minute == 30:
        logger.info("⏰ Finalizando Turno A - Eliminando validaciones pendientes")
        cleanup_turn_validations('A')
    
    # Turno B termina a las 6:30 AM (06:30)
    if current_hour == 6 and current_minute == 30:
        logger.info("⏰ Finalizando Turno B - Eliminando validaciones pendientes")
        cleanup_turn_validations('B')

def start_cleanup_scheduler():
    """Iniciar el programador de tareas de limpieza"""
    # Ejecutar limpieza diaria a las 2:00 AM
    schedule.every().day.at("02:00").do(run_cleanup_task)
    
    # Limpiar validaciones al finalizar turnos
    # Turno A: 6:30 PM
    schedule.every().day.at("18:30").do(lambda: cleanup_turn_validations('A'))
    # Turno B: 6:30 AM
    schedule.every().day.at("06:30").do(lambda: cleanup_turn_validations('B'))
    
    # También ejecutar cada 12 horas si el disco está por llenarse
    def check_and_cleanup_if_needed():
        status = get_storage_status()
        if status['disk_usage']['percent_used'] >= DISK_SPACE_WARNING_THRESHOLD:
            run_cleanup_task()
    
    schedule.every(12).hours.do(check_and_cleanup_if_needed)
    
    def run_scheduler():
        while True:
            schedule.run_pending()
            time.sleep(60)  # Verificar cada minuto para detectar los horarios exactos
    
    # Ejecutar en un hilo separado
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    storage_logger.info("Programador de limpieza automática iniciado")
    storage_logger.info("  - Limpieza diaria de PDFs a las 2:00 AM")
    storage_logger.info("  - Limpieza de validaciones Turno A a las 6:30 PM")
    storage_logger.info("  - Limpieza de validaciones Turno B a las 6:30 AM")
    storage_logger.info("  - Verificación cada 12 horas si el disco está por llenarse")

