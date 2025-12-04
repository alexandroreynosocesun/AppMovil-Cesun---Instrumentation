from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import os
from ..database import get_db
from ..models.models import AuditoriaPDF
from ..schemas import AuditoriaPDF as AuditoriaPDFSchema, PaginatedResponse
from ..auth import get_current_user
from ..models.models import Tecnico
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.get("/", response_model=PaginatedResponse[AuditoriaPDFSchema])
async def get_auditoria_pdfs(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    dia: Optional[int] = Query(None, ge=1, le=31, description="Filtrar por día del mes"),
    mes: Optional[int] = Query(None, ge=1, le=12, description="Filtrar por mes"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    turno: Optional[str] = Query(None, description="Filtrar por turno (A, B, C)"),
    linea: Optional[str] = Query(None, description="Filtrar por línea"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener PDFs de auditoría con filtros opcionales y paginación
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    - **dia**: Filtrar por día del mes (1-31)
    - **mes**: Filtrar por mes (1-12)
    - **anio**: Filtrar por año
    - **turno**: Filtrar por turno (A, B, C)
    - **linea**: Filtrar por línea
    """
    from ..utils.pagination import paginate_query
    from ..schemas import PaginatedResponse
    
    query = db.query(AuditoriaPDF)
    
    # Aplicar filtros
    if dia:
        query = query.filter(AuditoriaPDF.fecha_dia == dia)
    if mes:
        query = query.filter(AuditoriaPDF.fecha_mes == mes)
    if anio:
        query = query.filter(AuditoriaPDF.fecha_anio == anio)
    if turno:
        query = query.filter(AuditoriaPDF.turno == turno.upper())
    if linea:
        query = query.filter(AuditoriaPDF.linea == linea)
    
    # Ordenar por fecha más reciente primero
    query = query.order_by(AuditoriaPDF.fecha.desc())
    
    items, total, pages = paginate_query(query, page, page_size)
    
    return PaginatedResponse(
        items=[AuditoriaPDFSchema.from_orm(pdf) for pdf in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/download/{pdf_id}")
async def download_auditoria_pdf(
    pdf_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Descargar un PDF de auditoría"""
    pdf_record = db.query(AuditoriaPDF).filter(AuditoriaPDF.id == pdf_id).first()
    
    if not pdf_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF no encontrado"
        )
    
    # Verificar que el archivo existe
    if not os.path.exists(pdf_record.ruta_archivo):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo PDF no encontrado en el servidor"
        )
    
    return FileResponse(
        path=pdf_record.ruta_archivo,
        filename=pdf_record.nombre_archivo,
        media_type='application/pdf'
    )

@router.delete("/{pdf_id}")
async def delete_auditoria_pdf(
    pdf_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar un PDF de auditoría (solo adminAlex)"""
    # Verificar que el usuario es adminAlex
    if current_user.usuario != "adminAlex":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador puede eliminar PDFs"
        )
    
    # Buscar el PDF
    pdf_record = db.query(AuditoriaPDF).filter(AuditoriaPDF.id == pdf_id).first()
    
    if not pdf_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF no encontrado"
        )
    
    # Usar el servicio de almacenamiento para eliminar el archivo
    from ..services.storage_service import cleanup_when_deleted_from_db
    cleanup_when_deleted_from_db(pdf_record)
    
    # Eliminar el registro de la base de datos
    db.delete(pdf_record)
    db.commit()
    
    return {
        "success": True,
        "message": f"PDF {pdf_record.nombre_archivo} eliminado exitosamente"
    }

@router.get("/stats")
async def get_auditoria_stats(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener estadísticas de auditoría"""
    total_pdfs = db.query(AuditoriaPDF).count()
    
    # PDFs por año
    pdfs_por_anio = db.query(
        AuditoriaPDF.fecha_anio,
        func.count(AuditoriaPDF.id).label('count')
    ).group_by(AuditoriaPDF.fecha_anio).all()
    
    # PDFs por mes (del año actual)
    anio_actual = datetime.now().year
    pdfs_por_mes = db.query(
        AuditoriaPDF.fecha_mes,
        func.count(AuditoriaPDF.id).label('count')
    ).filter(
        AuditoriaPDF.fecha_anio == anio_actual
    ).group_by(AuditoriaPDF.fecha_mes).all()
    
    # PDFs por turno
    pdfs_por_turno = db.query(
        AuditoriaPDF.turno,
        func.count(AuditoriaPDF.id).label('count')
    ).group_by(AuditoriaPDF.turno).all()
    
    return {
        "total_pdfs": total_pdfs,
        "por_anio": {str(anio): count for anio, count in pdfs_por_anio},
        "por_mes": {str(mes): count for mes, count in pdfs_por_mes},
        "por_turno": {turno: count for turno, count in pdfs_por_turno}
    }

