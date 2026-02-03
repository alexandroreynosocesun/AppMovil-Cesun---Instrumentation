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
    Solo elimina en los días específicos para cada turno.
    
    Args:
        turno: 'A', 'B', o 'C'
    """
    db = SessionLocal()
    try:
        # Usar hora local del servidor para coincidir con los horarios programados
        now = datetime.now()
        current_weekday = now.weekday()  # 0 = Lunes, 1 = Martes, ..., 6 = Domingo
        
        # Verificar si es el día correcto para eliminar este turno
        should_cleanup = False
        target_date = None
        
        if turno == 'A':
            # Turno A: Se elimina a las 6:30 PM solo Lunes (0), Martes (1), Miércoles (2), Jueves (3)
            if current_weekday in [0, 1, 2, 3]:  # Lunes, Martes, Miércoles, Jueves
                target_date = now.date()
                should_cleanup = True
                logger.info(f"🧹 Limpiando validaciones del Turno A del {target_date} (Lunes-Jueves, 6:30 PM)")
        
        elif turno == 'B':
            # Turno B: Se elimina a las 6:30 AM solo Martes (1), Miércoles (2), Jueves (3), Viernes (4)
            # Como el turno B cruza medianoche, eliminamos las del día anterior
            if current_weekday in [1, 2, 3, 4]:  # Martes, Miércoles, Jueves, Viernes
                target_date = (now - timedelta(days=1)).date()
                should_cleanup = True
                logger.info(f"🧹 Limpiando validaciones del Turno B del {target_date} (Martes-Viernes, 6:30 AM)")
        
        elif turno == 'C':
            # Turno C: Se elimina a las 6:30 PM solo Viernes (4), Sábado (5), Domingo (6)
            if current_weekday in [4, 5, 6]:  # Viernes, Sábado, Domingo
                target_date = now.date()
                should_cleanup = True
                logger.info(f"🧹 Limpiando validaciones del Turno C del {target_date} (Viernes-Domingo, 6:30 PM)")
        
        # Si no es el día correcto, no hacer nada
        if not should_cleanup:
            day_names = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
            logger.debug(f"⏭️ No es día de limpieza para Turno {turno} (hoy es {day_names[current_weekday]})")
            return 0
        
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
        
        if count_before == 0:
            logger.info(f"ℹ️ No hay validaciones del Turno {turno} del {target_date} para eliminar")
            return 0
        
        # Eliminar todas las validaciones del turno (sin filtrar por tecnico_asignado_id o completada)
        deleted_count = db.query(Validacion).filter(
            Validacion.turno == turno,
            Validacion.fecha >= start_datetime,
            Validacion.fecha < end_datetime
        ).delete(synchronize_session=False)
        
        db.commit()
        
        # Actualizar la secuencia de IDs después de eliminar registros
        # Esto previene errores de "llave duplicada" cuando se crean nuevas validaciones
        if deleted_count > 0:
            try:
                from sqlalchemy import text
                # Obtener el máximo ID actual
                max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM validaciones"))
                max_id = max_id_result.scalar()
                # Actualizar la secuencia al siguiente valor disponible
                db.execute(text(f"SELECT setval('validaciones_id_seq', {max_id}, true)"))
                db.commit()
                logger.info(f"✅ Secuencia de IDs actualizada a {max_id}")
            except Exception as seq_error:
                logger.warning(f"⚠️ No se pudo actualizar la secuencia de IDs: {seq_error}")
                # No fallar si no se puede actualizar la secuencia
        
        logger.info(f"✅ Eliminadas {deleted_count} validaciones del Turno {turno} del {target_date} (contadas: {count_before})")
        logger.info(f"   - Esto incluye todas las validaciones asignadas y no asignadas del turno")
        return deleted_count
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error eliminando validaciones del turno {turno}: {e}", exc_info=True)
        return 0
    finally:
        db.close()

def cleanup_daily_validations(target_date, label):
    """
    Eliminar TODAS las validaciones de una fecha específica.
    Si no hay registros, no falla y solo registra el evento.
    """
    db = SessionLocal()
    try:
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time()) + timedelta(days=1)

        count_before = db.query(Validacion).filter(
            Validacion.fecha >= start_datetime,
            Validacion.fecha < end_datetime
        ).count()

        if count_before == 0:
            logger.info(f"ℹ️ [{label}] No hay validaciones del {target_date} para eliminar")
            return 0

        deleted_count = db.query(Validacion).filter(
            Validacion.fecha >= start_datetime,
            Validacion.fecha < end_datetime
        ).delete(synchronize_session=False)

        db.commit()

        if deleted_count > 0:
            try:
                from sqlalchemy import text
                max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM validaciones"))
                max_id = max_id_result.scalar()
                db.execute(text(f"SELECT setval('validaciones_id_seq', {max_id}, true)"))
                db.commit()
                logger.info(f"✅ [{label}] Secuencia de IDs actualizada a {max_id}")
            except Exception as seq_error:
                logger.warning(f"⚠️ [{label}] No se pudo actualizar la secuencia de IDs: {seq_error}")

        logger.info(f"✅ [{label}] Eliminadas {deleted_count} validaciones del {target_date} (contadas: {count_before})")
        return deleted_count
    except Exception as e:
        db.rollback()
        logger.error(f"❌ [{label}] Error eliminando validaciones del {target_date}: {e}", exc_info=True)
        return 0
    finally:
        db.close()

def mark_no_validado_for_date(target_date, label):
    """
    Marcar como NO_VALIDADO las validaciones no completadas de una fecha específica.
    No falla si no hay registros; solo registra el evento.
    """
    db = SessionLocal()
    try:
        start_datetime = datetime.combine(target_date, datetime.min.time())
        end_datetime = datetime.combine(target_date, datetime.max.time()) + timedelta(days=1)

        count_before = db.query(Validacion).filter(
            Validacion.fecha >= start_datetime,
            Validacion.fecha < end_datetime,
            Validacion.completada == False
        ).count()

        if count_before == 0:
            logger.info(f"ℹ️ [{label}] No hay validaciones pendientes del {target_date} para marcar NO_VALIDADO")
            return 0

        updated_count = db.query(Validacion).filter(
            Validacion.fecha >= start_datetime,
            Validacion.fecha < end_datetime,
            Validacion.completada == False
        ).update(
            {Validacion.estado: "NO_VALIDADO"},
            synchronize_session=False
        )

        db.commit()
        logger.info(f"✅ [{label}] Marcadas {updated_count} validaciones como NO_VALIDADO del {target_date} (contadas: {count_before})")
        return updated_count
    except Exception as e:
        db.rollback()
        logger.error(f"❌ [{label}] Error marcando NO_VALIDADO del {target_date}: {e}", exc_info=True)
        return 0
    finally:
        db.close()

def start_cleanup_scheduler():
    """Iniciar el programador de tareas de limpieza"""
    # Ejecutar limpieza diaria a las 2:00 AM
    schedule.every().day.at("02:00").do(run_cleanup_task)
    
    # Limpieza diaria de validaciones (7:00 AM y 7:00 PM)
    # 7:00 AM -> elimina validaciones del día anterior
    # 7:00 PM -> elimina validaciones del día actual
    schedule.every().day.at("06:30").do(
        lambda: mark_no_validado_for_date((datetime.now() - timedelta(days=1)).date(), "06:30 AM")
    )
    schedule.every().day.at("18:30").do(
        lambda: mark_no_validado_for_date(datetime.now().date(), "06:30 PM")
    )
    schedule.every().day.at("07:00").do(
        lambda: cleanup_daily_validations((datetime.now() - timedelta(days=1)).date(), "07:00 AM")
    )
    schedule.every().day.at("19:00").do(
        lambda: cleanup_daily_validations(datetime.now().date(), "07:00 PM")
    )
    
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
    storage_logger.info("  - Limpieza de validaciones diaria a las 7:00 AM (día anterior)")
    storage_logger.info("  - Limpieza de validaciones diaria a las 7:00 PM (día actual)")
    storage_logger.info("  - Marcado NO_VALIDADO a las 6:30 AM (día anterior)")
    storage_logger.info("  - Marcado NO_VALIDADO a las 6:30 PM (día actual)")
    storage_logger.info("  - Verificación cada 12 horas si el disco está por llenarse")

