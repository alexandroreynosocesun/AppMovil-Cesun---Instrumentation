"""
Router para gestión de almacenamiento de PDFs
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from ..database import get_db
from ..auth import get_current_user
from ..models.models import Tecnico
from ..services.storage_service import (
    get_storage_status,
    cleanup_old_pdfs,
    compress_old_pdfs,
    get_disk_usage
)
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.get("/status")
async def get_storage_status_endpoint(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener estado del almacenamiento (solo adminAlex)"""
    if current_user.usuario != "adminAlex":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede ver el estado del almacenamiento"
        )
    
    status_info = get_storage_status()
    return status_info

@router.post("/cleanup")
async def cleanup_pdfs_endpoint(
    days: int = 365,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Limpiar PDFs antiguos (solo adminAlex)"""
    if current_user.usuario != "adminAlex":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede limpiar PDFs"
        )
    
    result = cleanup_old_pdfs(db, days=days)
    return {
        "success": True,
        "message": f"Limpieza completada: {result['deleted_files']} archivos, {result['deleted_records']} registros, {result['freed_space_mb']} MB liberados",
        **result
    }

@router.post("/compress")
async def compress_pdfs_endpoint(
    days: int = 180,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Comprimir PDFs antiguos (solo adminAlex)"""
    if current_user.usuario != "adminAlex":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede comprimir PDFs"
        )
    
    result = compress_old_pdfs(db, days=days)
    return {
        "success": True,
        "message": f"Compresión completada: {result['compressed_files']} archivos comprimidos, {result['zip_files_created']} ZIPs creados, {result['saved_space_mb']} MB ahorrados",
        **result
    }

@router.get("/disk-usage")
async def get_disk_usage_endpoint(
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener uso del disco (solo adminAlex)"""
    if current_user.usuario != "adminAlex":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede ver el uso del disco"
        )
    
    disk_info = get_disk_usage()
    
    # Determinar estado
    status = "ok"
    message = "Espacio en disco suficiente"
    
    if disk_info['percent_used'] >= 95:
        status = "critical"
        message = "⚠️ CRÍTICO: El disco está casi lleno (>95%)"
    elif disk_info['percent_used'] >= 85:
        status = "warning"
        message = "⚠️ ADVERTENCIA: El disco está por llenarse (>85%)"
    
    return {
        "disk_usage": disk_info,
        "status": status,
        "message": message
    }

