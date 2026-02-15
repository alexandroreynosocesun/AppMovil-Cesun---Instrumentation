from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, String
from typing import List, Optional
from datetime import datetime, timezone
import os
from ..database import get_db
from ..models.models import AuditoriaPDF, Tecnico
from ..schemas import AuditoriaPDF as AuditoriaPDFSchema, PaginatedResponse
from ..auth import get_current_user
from ..utils.logger import get_logger
from ..services.cache_service import cache_service

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
    tecnico_id: Optional[int] = Query(None, description="Filtrar por ID de técnico"),
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
    - **tecnico_id**: Filtrar por ID de técnico
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
    if tecnico_id:
        query = query.filter(AuditoriaPDF.tecnico_id == tecnico_id)
    if linea:
        # Normalizar la línea para la comparación (convertir a string, eliminar espacios)
        linea_normalizada = str(linea).strip() if linea else None
        if linea_normalizada:
            logger.info(f"🔍 Filtrando por línea: '{linea_normalizada}' (valor original: '{linea}')")
            
            # Usar comparación con cast a string y trim para asegurar compatibilidad
            # Esto maneja casos donde la línea puede tener espacios o diferentes formatos
            query = query.filter(
                func.trim(func.cast(AuditoriaPDF.linea, String)) == linea_normalizada
            )
            logger.info(f"✅ Filtro de línea aplicado: '{linea_normalizada}'")
    
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

@router.delete("/delete-all")
async def delete_all_auditoria_pdfs(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar TODOS los PDFs de auditoría (solo para administradores)"""
    # Verificar que el usuario sea administrador
    if current_user.tipo_usuario != "admin" and current_user.usuario not in ["admin", "adminAlex", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden eliminar todos los PDFs"
        )
    
    try:
        # Contar PDFs antes de eliminar
        total_pdfs = db.query(AuditoriaPDF).count()
        
        if total_pdfs == 0:
            return {
                "success": True,
                "message": "No hay PDFs para eliminar",
                "deleted_count": 0
            }
        
        # Obtener rutas de archivos antes de eliminar registros
        pdfs = db.query(AuditoriaPDF).all()
        pdf_paths = [pdf.ruta_archivo for pdf in pdfs]
        
        # Eliminar todos los registros de la base de datos PRIMERO (más rápido)
        deleted_count = db.query(AuditoriaPDF).delete()
        db.commit()
        
        # Luego eliminar archivos físicos en segundo plano (no bloquea la respuesta)
        from ..services.storage_service import cleanup_when_deleted_from_db
        deleted_files = 0
        import os
        for pdf_path in pdf_paths:
            try:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                    deleted_files += 1
            except Exception as e:
                logger.warning(f"⚠️ Error eliminando archivo {pdf_path}: {e}")
        
        # Invalidar caché
        cache_service.delete("auditoria:stats")
        cache_service.delete("auditoria:tecnicos")

        logger.info(f"⚠️ TODOS LOS PDFs DE AUDITORÍA ELIMINADOS por {current_user.usuario}. Total: {deleted_count}")

        return {
            "success": True,
            "message": f"Todos los PDFs eliminados correctamente",
            "deleted_count": deleted_count,
            "deleted_files": deleted_files
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error eliminando todos los PDFs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando PDFs: {str(e)}"
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

    # Invalidar caché
    cache_service.delete("auditoria:stats")
    cache_service.delete("auditoria:tecnicos")

    return {
        "success": True,
        "message": f"PDF {pdf_record.nombre_archivo} eliminado exitosamente"
    }

@router.get("/stats")
async def get_auditoria_stats(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener estadísticas de auditoría (con caché de 5 min)"""
    # Intentar obtener de caché
    cached = cache_service.get("auditoria:stats")
    if cached:
        return cached

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

    # PDFs por técnico
    pdfs_por_tecnico = db.query(
        AuditoriaPDF.tecnico_id,
        AuditoriaPDF.tecnico_nombre,
        func.count(AuditoriaPDF.id).label('count')
    ).group_by(AuditoriaPDF.tecnico_id, AuditoriaPDF.tecnico_nombre).all()

    # PDFs por línea (excluyendo None)
    pdfs_por_linea = db.query(
        AuditoriaPDF.linea,
        func.count(AuditoriaPDF.id).label('count')
    ).filter(
        AuditoriaPDF.linea.isnot(None)
    ).group_by(AuditoriaPDF.linea).all()

    # Obtener lista de años disponibles ordenados
    anios_disponibles = sorted([anio for anio, _ in pdfs_por_anio], reverse=True)

    # Obtener lista de líneas disponibles ordenadas (excluyendo None)
    lineas_disponibles = sorted([str(linea).strip() for linea, _ in pdfs_por_linea if linea], reverse=False)

    result = {
        "total_pdfs": total_pdfs,
        "por_anio": {str(anio): count for anio, count in pdfs_por_anio},
        "anios_disponibles": anios_disponibles,
        "por_mes": {str(mes): count for mes, count in pdfs_por_mes},
        "por_turno": {turno: count for turno, count in pdfs_por_turno},
        "por_tecnico": {str(tecnico_id): {"nombre": nombre, "count": count} for tecnico_id, nombre, count in pdfs_por_tecnico},
        "por_linea": {str(linea): count for linea, count in pdfs_por_linea if linea},
        "lineas_disponibles": lineas_disponibles
    }

    # Guardar en caché por 5 minutos
    cache_service.set("auditoria:stats", result, ttl=300)

    return result

@router.get("/tecnicos")
async def get_tecnicos_con_reportes(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener lista de técnicos con rol 'tecnico' o 'validaciones' (con caché de 5 min)
    """
    # Intentar obtener de caché
    cached = cache_service.get("auditoria:tecnicos")
    if cached:
        return cached

    tecnicos_base = db.query(Tecnico).filter(
        Tecnico.tipo_usuario.in_(['tecnico', 'validaciones']),
        Tecnico.activo == True
    ).order_by(Tecnico.nombre).all()

    if not tecnicos_base:
        return {"tecnicos": [], "total": 0}

    tecnico_ids = [t.id for t in tecnicos_base]

    conteos = db.query(
        AuditoriaPDF.tecnico_id,
        func.count(AuditoriaPDF.id).label('total')
    ).filter(
        AuditoriaPDF.tecnico_id.in_(tecnico_ids)
    ).group_by(AuditoriaPDF.tecnico_id).all()

    conteos_dict = {tecnico_id: int(total) for tecnico_id, total in conteos}

    tecnicos = [
        {
            "id": tecnico.id,
            "nombre": tecnico.nombre,
            "numero_empleado": tecnico.numero_empleado,
            "total_reportes": conteos_dict.get(tecnico.id, 0)
        }
        for tecnico in tecnicos_base
    ]

    result = {"tecnicos": tecnicos, "total": len(tecnicos)}

    # Guardar en caché por 5 minutos
    cache_service.set("auditoria:tecnicos", result, ttl=300)

    return result

@router.get("/debug-lineas")
async def debug_lineas(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Endpoint de debugging para ver qué valores de línea hay en la base de datos
    """
    # Verificar que el usuario es admin
    if current_user.tipo_usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden ver esta información"
        )
    
    try:
        # Obtener todas las líneas únicas
        lineas_unicas = db.query(AuditoriaPDF.linea).distinct().all()
        
        # Contar PDFs por línea
        pdfs_por_linea = db.query(
            AuditoriaPDF.linea,
            func.count(AuditoriaPDF.id).label('count')
        ).group_by(AuditoriaPDF.linea).all()
        
        # Formatear respuesta
        lineas_info = []
        for linea, count in pdfs_por_linea:
            linea_str = str(linea) if linea else 'None'
            linea_type = type(linea).__name__ if linea else 'None'
            lineas_info.append({
                "linea": linea_str,
                "tipo": linea_type,
                "count": count,
                "repr": repr(linea) if linea else 'None'
            })
        
        return {
            "total_lineas_unicas": len(lineas_unicas),
            "lineas": lineas_info,
            "total_pdfs": sum(p[1] for p in pdfs_por_linea)
        }
    except Exception as e:
        logger.error(f"❌ Error en debug de líneas: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )

@router.post("/fix-fechas")
async def fix_fechas_auditoria(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Corregir las fechas (fecha_dia, fecha_mes, fecha_anio) de todos los PDFs de auditoría
    basándose en el campo fecha real. Solo para administradores.
    """
    # Verificar que el usuario es admin
    if current_user.tipo_usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden corregir fechas"
        )
    
    try:
        # Obtener todos los PDFs
        pdfs = db.query(AuditoriaPDF).all()
        logger.info(f"🔧 Corrigiendo fechas de {len(pdfs)} PDFs...")
        
        corregidos = 0
        sin_cambios = 0
        
        for pdf in pdfs:
            # Obtener la fecha del PDF
            fecha_obj = pdf.fecha
            
            # Convertir a UTC si tiene timezone, o usar directamente si es naive
            if fecha_obj.tzinfo is not None:
                # Convertir a UTC para evitar problemas de zona horaria
                fecha_utc = fecha_obj.astimezone(timezone.utc)
                fecha_date = fecha_utc.date()
            else:
                # Si no tiene timezone, asumir que ya está en la zona correcta
                fecha_date = fecha_obj.date()
            
            # Extraer día, mes y año de la fecha (sin hora)
            fecha_dia_correcta = fecha_date.day
            fecha_mes_correcta = fecha_date.month
            fecha_anio_correcta = fecha_date.year
            
            # Verificar si necesita corrección
            if (pdf.fecha_dia != fecha_dia_correcta or 
                pdf.fecha_mes != fecha_mes_correcta or 
                pdf.fecha_anio != fecha_anio_correcta):
                
                logger.info(f"📅 Corrigiendo PDF ID={pdf.id}: día {pdf.fecha_dia}->{fecha_dia_correcta}, mes {pdf.fecha_mes}->{fecha_mes_correcta}, año {pdf.fecha_anio}->{fecha_anio_correcta}")
                
                pdf.fecha_dia = fecha_dia_correcta
                pdf.fecha_mes = fecha_mes_correcta
                pdf.fecha_anio = fecha_anio_correcta
                corregidos += 1
            else:
                sin_cambios += 1
        
        # Guardar todos los cambios
        db.commit()
        
        logger.info(f"✅ Corrección completada: {corregidos} PDFs corregidos, {sin_cambios} sin cambios")
        
        return {
            "success": True,
            "message": f"Corrección completada: {corregidos} PDFs corregidos, {sin_cambios} sin cambios",
            "corregidos": corregidos,
            "sin_cambios": sin_cambios,
            "total": len(pdfs)
        }
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error corrigiendo fechas: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error corrigiendo fechas: {str(e)}"
        )

@router.post("/fix-datos")
async def fix_datos_auditoria(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Corregir fechas y líneas de todos los PDFs de auditoría
    - Corrige fecha_dia, fecha_mes, fecha_anio basándose en el campo fecha
    - Normaliza el campo linea (elimina espacios, convierte '-' a None)
    Solo para administradores.
    """
    # Verificar que el usuario es admin
    if current_user.tipo_usuario not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden corregir datos"
        )
    
    try:
        # Obtener todos los PDFs
        pdfs = db.query(AuditoriaPDF).all()
        logger.info(f"🔧 Corrigiendo datos de {len(pdfs)} PDFs...")
        
        fechas_corregidas = 0
        lineas_corregidas = 0
        sin_cambios = 0
        
        for pdf in pdfs:
            cambios = False
            
            # Corregir fechas
            if pdf.fecha:
                if pdf.fecha.tzinfo is not None:
                    fecha_utc = pdf.fecha.astimezone(timezone.utc)
                    fecha_date = fecha_utc.date()
                else:
                    fecha_date = pdf.fecha.date()
                
                fecha_dia_correcta = fecha_date.day
                fecha_mes_correcta = fecha_date.month
                fecha_anio_correcta = fecha_date.year
                
                if (pdf.fecha_dia != fecha_dia_correcta or 
                    pdf.fecha_mes != fecha_mes_correcta or 
                    pdf.fecha_anio != fecha_anio_correcta):
                    pdf.fecha_dia = fecha_dia_correcta
                    pdf.fecha_mes = fecha_mes_correcta
                    pdf.fecha_anio = fecha_anio_correcta
                    fechas_corregidas += 1
                    cambios = True
                    logger.info(f"📅 PDF ID={pdf.id}: día {pdf.fecha_dia}->{fecha_dia_correcta}, mes {pdf.fecha_mes}->{fecha_mes_correcta}, año {pdf.fecha_anio}->{fecha_anio_correcta}")
            
            # Corregir línea (normalizar si es '-', None, o tiene espacios)
            linea_original = pdf.linea
            if pdf.linea:
                linea_normalizada = str(pdf.linea).strip()
                if linea_normalizada == '-' or linea_normalizada == '':
                    pdf.linea = None
                    lineas_corregidas += 1
                    cambios = True
                    logger.info(f"🔧 PDF ID={pdf.id}: línea '{linea_original}' -> None")
                elif linea_normalizada != str(pdf.linea):
                    pdf.linea = linea_normalizada
                    lineas_corregidas += 1
                    cambios = True
                    logger.info(f"🔧 PDF ID={pdf.id}: línea '{linea_original}' -> '{linea_normalizada}'")
            elif pdf.linea is None:
                # Ya está None, no hay que hacer nada
                pass
            
            if not cambios:
                sin_cambios += 1
        
        # Guardar todos los cambios
        db.commit()
        
        logger.info(f"✅ Corrección completada: {fechas_corregidas} fechas corregidas, {lineas_corregidas} líneas corregidas, {sin_cambios} sin cambios")
        
        return {
            "success": True,
            "message": f"Corrección completada: {fechas_corregidas} fechas corregidas, {lineas_corregidas} líneas corregidas, {sin_cambios} sin cambios",
            "fechas_corregidas": fechas_corregidas,
            "lineas_corregidas": lineas_corregidas,
            "sin_cambios": sin_cambios,
            "total": len(pdfs)
        }
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error corrigiendo datos: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error corrigiendo datos: {str(e)}"
        )

