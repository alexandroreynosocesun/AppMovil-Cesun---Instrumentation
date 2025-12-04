"""
Servicio para gestión de almacenamiento de PDFs:
- Limpieza automática de PDFs antiguos
- Monitoreo de espacio en disco
- Compresión de PDFs antiguos
"""
import os
import shutil
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from ..models.models import AuditoriaPDF
from ..config import (
    REPORTS_DIR,
    ARCHIVE_DIR,
    CLEANUP_DAYS,
    COMPRESS_DAYS,
    DISK_SPACE_WARNING_THRESHOLD,
    DISK_SPACE_CRITICAL_THRESHOLD
)
from ..utils.logger import storage_logger
from ..config import (
    REPORTS_DIR,
    ARCHIVE_DIR,
    CLEANUP_DAYS,
    COMPRESS_DAYS,
    DISK_SPACE_WARNING_THRESHOLD,
    DISK_SPACE_CRITICAL_THRESHOLD
)
from ..utils.logger import get_logger

logger = get_logger(__name__)

def get_disk_usage(path: str = ".") -> Dict[str, float]:
    """
    Obtener uso del disco en porcentaje y espacio disponible
    
    Returns:
        dict: {
            'total_gb': float,
            'used_gb': float,
            'free_gb': float,
            'percent_used': float
        }
    """
    try:
        if os.name == 'nt':  # Windows
            import shutil
            total, used, free = shutil.disk_usage(path)
        else:  # Linux/Mac
            stat = os.statvfs(path)
            total = stat.f_blocks * stat.f_frsize
            free = stat.f_bavail * stat.f_frsize
            used = (stat.f_blocks - stat.f_bavail) * stat.f_frsize
        
        total_gb = total / (1024 ** 3)
        used_gb = used / (1024 ** 3)
        free_gb = free / (1024 ** 3)
        percent_used = (used / total) * 100
        
        return {
            'total_gb': round(total_gb, 2),
            'used_gb': round(used_gb, 2),
            'free_gb': round(free_gb, 2),
            'percent_used': round(percent_used, 2)
        }
    except Exception as e:
        logger.error(f"Error obteniendo uso del disco: {e}", exc_info=True)
        return {
            'total_gb': 0,
            'used_gb': 0,
            'free_gb': 0,
            'percent_used': 0
        }

def get_storage_status() -> Dict[str, any]:
    """
    Obtener estado del almacenamiento de PDFs
    
    Returns:
        dict: Información sobre el almacenamiento
    """
    disk_info = get_disk_usage()
    
    # Contar archivos PDF
    pdf_count = 0
    total_size_mb = 0
    reports_path = Path(REPORTS_DIR)
    
    if reports_path.exists():
        for pdf_file in reports_path.glob("*.pdf"):
            if pdf_file.is_file():
                pdf_count += 1
                total_size_mb += pdf_file.stat().st_size / (1024 ** 2)
    
    # Contar archivos comprimidos
    archive_count = 0
    archive_size_mb = 0
    archive_path = Path(ARCHIVE_DIR)
    if archive_path.exists():
        for zip_file in archive_path.glob("*.zip"):
            if zip_file.is_file():
                archive_count += 1
                archive_size_mb += zip_file.stat().st_size / (1024 ** 2)
    
    # Determinar estado de alerta
    status = "ok"
    if disk_info['percent_used'] >= DISK_SPACE_CRITICAL_THRESHOLD:
        status = "critical"
    elif disk_info['percent_used'] >= DISK_SPACE_WARNING_THRESHOLD:
        status = "warning"
    
    return {
        'disk_usage': disk_info,
        'pdf_count': pdf_count,
        'pdf_total_size_mb': round(total_size_mb, 2),
        'archive_count': archive_count,
        'archive_total_size_mb': round(archive_size_mb, 2),
        'status': status,
        'reports_dir': REPORTS_DIR,
        'archive_dir': ARCHIVE_DIR
    }

def cleanup_old_pdfs(db: Session, days: int = CLEANUP_DAYS) -> Dict[str, int]:
    """
    Eliminar PDFs antiguos y sus registros de la BD
    
    Args:
        db: Sesión de base de datos
        days: Días de antigüedad para considerar un PDF como "antiguo"
    
    Returns:
        dict: {
            'deleted_files': int,
            'deleted_records': int,
            'freed_space_mb': float
        }
    """
    deleted_files = 0
    deleted_records = 0
    freed_space_mb = 0
    
    try:
        # Calcular fecha límite
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Buscar PDFs antiguos en la BD
        old_pdfs = db.query(AuditoriaPDF).filter(
            AuditoriaPDF.fecha < cutoff_date
        ).all()
        
        storage_logger.info(f"Encontrados {len(old_pdfs)} PDFs antiguos para eliminar (más de {days} días)")
        
        for pdf_record in old_pdfs:
            # Eliminar archivo físico si existe
            if pdf_record.ruta_archivo and os.path.exists(pdf_record.ruta_archivo):
                try:
                    file_size_mb = os.path.getsize(pdf_record.ruta_archivo) / (1024 ** 2)
                    os.remove(pdf_record.ruta_archivo)
                    deleted_files += 1
                    freed_space_mb += file_size_mb
                    storage_logger.debug(f"Eliminado: {pdf_record.nombre_archivo} ({file_size_mb:.2f} MB)")
                except Exception as e:
                    storage_logger.warning(f"Error eliminando archivo {pdf_record.ruta_archivo}: {e}")
            
            # Eliminar registro de la BD
            try:
                db.delete(pdf_record)
                deleted_records += 1
            except Exception as e:
                storage_logger.warning(f"Error eliminando registro {pdf_record.id}: {e}")
        
        db.commit()
        
        # Limpiar archivos huérfanos (archivos sin registro en BD)
        orphaned_count = cleanup_orphaned_files()
        if orphaned_count > 0:
            storage_logger.info(f"Eliminados {orphaned_count} archivos huérfanos")
        
        storage_logger.info(f"Limpieza completada: {deleted_files} archivos, {deleted_records} registros, {round(freed_space_mb, 2)} MB liberados")
        
        return {
            'deleted_files': deleted_files,
            'deleted_records': deleted_records,
            'freed_space_mb': round(freed_space_mb, 2)
        }
        
    except Exception as e:
        storage_logger.error(f"Error en limpieza de PDFs: {e}", exc_info=True)
        db.rollback()
        return {
            'deleted_files': deleted_files,
            'deleted_records': deleted_records,
            'freed_space_mb': round(freed_space_mb, 2)
        }

def cleanup_orphaned_files() -> int:
    """
    Eliminar archivos PDF que no tienen registro en la BD
    
    Returns:
        int: Número de archivos eliminados
    """
    deleted = 0
    try:
        reports_path = Path(REPORTS_DIR)
        if not reports_path.exists():
            return 0
        
        # Obtener todos los nombres de archivo de la BD
        from ..database import SessionLocal
        db = SessionLocal()
        try:
            pdf_records = db.query(AuditoriaPDF.nombre_archivo).all()
            registered_files = {record[0] for record in pdf_records}
            
            # Buscar archivos no registrados
            for pdf_file in reports_path.glob("*.pdf"):
                if pdf_file.name not in registered_files:
                    try:
                        pdf_file.unlink()
                        deleted += 1
                        logger.debug(f"Archivo huérfano eliminado: {pdf_file.name}")
                    except Exception as e:
                        storage_logger.warning(f"Error eliminando archivo huérfano {pdf_file.name}: {e}")
        finally:
            db.close()
            
    except Exception as e:
        storage_logger.error(f"Error limpiando archivos huérfanos: {e}", exc_info=True)
    
    return deleted

def compress_old_pdfs(db: Session, days: int = COMPRESS_DAYS) -> Dict[str, any]:
    """
    Comprimir PDFs antiguos en archivos ZIP
    
    Args:
        db: Sesión de base de datos
        days: Días de antigüedad para comprimir
    
    Returns:
        dict: {
            'compressed_files': int,
            'zip_files_created': int,
            'saved_space_mb': float
        }
    """
    compressed_files = 0
    zip_files_created = 0
    saved_space_mb = 0
    
    try:
        # Crear directorio de archivos comprimidos
        os.makedirs(ARCHIVE_DIR, exist_ok=True)
        
        # Calcular fecha límite
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Buscar PDFs antiguos que no estén ya comprimidos
        old_pdfs = db.query(AuditoriaPDF).filter(
            AuditoriaPDF.fecha < cutoff_date,
            ~AuditoriaPDF.ruta_archivo.like('%.zip%')  # No comprimir si ya está en ZIP
        ).order_by(AuditoriaPDF.fecha).all()
        
        if not old_pdfs:
            return {
                'compressed_files': 0,
                'zip_files_created': 0,
                'saved_space_mb': 0
            }
        
        print(f"📦 Comprimiendo {len(old_pdfs)} PDFs antiguos")
        
        # Agrupar por mes para crear ZIPs mensuales
        pdfs_by_month = {}
        for pdf in old_pdfs:
            month_key = f"{pdf.fecha_anio}_{pdf.fecha_mes:02d}"
            if month_key not in pdfs_by_month:
                pdfs_by_month[month_key] = []
            pdfs_by_month[month_key].append(pdf)
        
        # Comprimir por mes
        for month_key, pdfs in pdfs_by_month.items():
            zip_filename = f"pdfs_{month_key}.zip"
            zip_path = os.path.join(ARCHIVE_DIR, zip_filename)
            
            # Si el ZIP ya existe, agregar a él
            if os.path.exists(zip_path):
                zip_mode = 'a'  # append
            else:
                zip_mode = 'w'  # write
                zip_files_created += 1
            
            original_size = 0
            with zipfile.ZipFile(zip_path, zip_mode, zipfile.ZIP_DEFLATED) as zipf:
                for pdf in pdfs:
                    if pdf.ruta_archivo and os.path.exists(pdf.ruta_archivo):
                        try:
                            file_size = os.path.getsize(pdf.ruta_archivo)
                            original_size += file_size
                            
                            # Agregar al ZIP
                            zipf.write(pdf.ruta_archivo, pdf.nombre_archivo)
                            
                            # Eliminar archivo original
                            os.remove(pdf.ruta_archivo)
                            
                            # Actualizar ruta en BD para apuntar al ZIP
                            pdf.ruta_archivo = zip_path
                            compressed_files += 1
                            
                        except Exception as e:
                            logger.warning(f"Error comprimiendo {pdf.nombre_archivo}: {e}")
            
            # Calcular espacio ahorrado
            if os.path.exists(zip_path):
                compressed_size = os.path.getsize(zip_path)
                saved_space_mb += (original_size - compressed_size) / (1024 ** 2)
        
        db.commit()
        
        logger.info(f"Compresión completada: {compressed_files} archivos, {zip_files_created} ZIPs creados, {round(saved_space_mb, 2)} MB ahorrados")
        
        return {
            'compressed_files': compressed_files,
            'zip_files_created': zip_files_created,
            'saved_space_mb': round(saved_space_mb, 2)
        }
        
    except Exception as e:
        logger.error(f"Error comprimiendo PDFs: {e}", exc_info=True)
        db.rollback()
        return {
            'compressed_files': compressed_files,
            'zip_files_created': zip_files_created,
            'saved_space_mb': round(saved_space_mb, 2)
        }

def cleanup_when_deleted_from_db(pdf_record: AuditoriaPDF) -> bool:
    """
    Eliminar archivo físico cuando se elimina de la BD
    
    Args:
        pdf_record: Registro de AuditoriaPDF que se va a eliminar
    
    Returns:
        bool: True si se eliminó exitosamente
    """
    try:
        if pdf_record.ruta_archivo and os.path.exists(pdf_record.ruta_archivo):
            # Si es un ZIP, no eliminar (puede contener otros PDFs)
            if pdf_record.ruta_archivo.endswith('.zip'):
                logger.warning(f"No se elimina ZIP {pdf_record.ruta_archivo} (puede contener otros PDFs)")
                return False
            
            os.remove(pdf_record.ruta_archivo)
            logger.debug(f"Archivo eliminado: {pdf_record.ruta_archivo}")
            return True
    except Exception as e:
        logger.warning(f"Error eliminando archivo {pdf_record.ruta_archivo}: {e}")
    return False

