from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.models import JigNG, Jig, Tecnico
from ..schemas import JigNG as JigNGSchema, JigNGCreate, JigNGUpdate, PaginatedResponse
from ..auth import get_current_user
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

def serialize_jig_ng(jig_ng, include_jig=False, include_foto=True, db=None):
    """Serializar objeto JigNG para incluir relaciones como diccionarios"""
    result = {
        "id": jig_ng.id,
        "jig_id": jig_ng.jig_id,
        "tecnico_id": jig_ng.tecnico_id,
        "fecha_ng": jig_ng.fecha_ng,
        "motivo": jig_ng.motivo,
        "categoria": jig_ng.categoria,
        "prioridad": jig_ng.prioridad,
        "estado": jig_ng.estado,
        "fecha_reparacion": jig_ng.fecha_reparacion,
        "tecnico_reparacion_id": jig_ng.tecnico_reparacion_id,
        "observaciones_reparacion": jig_ng.observaciones_reparacion,
        "foto": jig_ng.foto if include_foto else None,
        "sincronizado": jig_ng.sincronizado,
        "created_at": jig_ng.created_at,
        "tecnico_ng": {
            "id": jig_ng.tecnico_ng.id,
            "nombre": jig_ng.tecnico_ng.nombre,
            "numero_empleado": jig_ng.tecnico_ng.numero_empleado
        } if jig_ng.tecnico_ng else None,
        "tecnico_reparacion": {
            "id": jig_ng.tecnico_reparacion.id,
            "nombre": jig_ng.tecnico_reparacion.nombre,
            "numero_empleado": jig_ng.tecnico_reparacion.numero_empleado
        } if jig_ng.tecnico_reparacion else None
    }
    
    # Incluir información del jig si se solicita
    if include_jig:
        if hasattr(jig_ng, 'jig') and jig_ng.jig:
            result["jig"] = {
                "id": jig_ng.jig.id,
                "numero_jig": jig_ng.jig.numero_jig,
                "codigo_qr": jig_ng.jig.codigo_qr,
                "tipo": jig_ng.jig.tipo,
                "modelo_actual": jig_ng.jig.modelo_actual,
                "estado": jig_ng.jig.estado,
                "created_at": jig_ng.jig.created_at
            }
        else:
            # Si no se puede cargar el jig, buscar manualmente
            if db:
                from ..models.models import Jig
                jig = db.query(Jig).filter(Jig.id == jig_ng.jig_id).first()
            else:
                jig = None
            if jig:
                result["jig"] = {
                    "id": jig.id,
                    "numero_jig": jig.numero_jig,
                    "codigo_qr": jig.codigo_qr,
                    "tipo": jig.tipo,
                    "modelo_actual": jig.modelo_actual,
                    "estado": jig.estado,
                    "created_at": jig.created_at
                }
            else:
                result["jig"] = {
                    "id": jig_ng.jig_id,
                    "numero_jig": "N/A",
                    "codigo_qr": "N/A", 
                    "tipo": "N/A",
                    "modelo_actual": "N/A",
                    "estado": "N/A",
                    "created_at": None
                }
    
    return result

@router.get("/", response_model=PaginatedResponse[JigNGSchema])
async def get_jigs_ng(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    estado: Optional[str] = None,
    categoria: Optional[str] = None,
    include_foto: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener lista paginada de jigs NG con filtros opcionales
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    - **estado**: Filtrar por estado (pendiente, en_reparacion, reparado, descartado)
    - **categoria**: Filtrar por categoría
    """
    from sqlalchemy.orm import joinedload
    from ..utils.pagination import paginate_query
    from ..schemas import PaginatedResponse
    
    query = db.query(JigNG).options(
        joinedload(JigNG.tecnico_ng),
        joinedload(JigNG.tecnico_reparacion),
        joinedload(JigNG.jig)
    )
    
    if estado:
        estados = [s.strip() for s in estado.split(',') if s.strip()]
        if len(estados) == 1:
            query = query.filter(JigNG.estado == estados[0])
        elif len(estados) > 1:
            query = query.filter(JigNG.estado.in_(estados))
    if categoria:
        query = query.filter(JigNG.categoria == categoria)
    
    # Ordenar por fecha más reciente primero
    query = query.order_by(JigNG.fecha_ng.desc())
    
    items, total, pages = paginate_query(query, page, page_size)
    
    # Convertir a diccionario para incluir información de técnicos
    serialized_items = [
        serialize_jig_ng(jig_ng, include_jig=True, include_foto=include_foto, db=db)
        for jig_ng in items
    ]
    
    return PaginatedResponse(
        items=serialized_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/jig/{jig_id}", response_model=List[JigNGSchema])
async def get_jig_ng_by_jig_id(
    jig_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jigs NG por ID de jig"""
    jigs_ng = db.query(JigNG).filter(JigNG.jig_id == jig_id).all()
    return [serialize_jig_ng(jig_ng, include_jig=True, include_foto=True, db=db) for jig_ng in jigs_ng]

@router.get("/{jig_ng_id}", response_model=JigNGSchema)
async def get_jig_ng(
    jig_ng_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jig NG por ID"""
    jig_ng = db.query(JigNG).filter(JigNG.id == jig_ng_id).first()
    if not jig_ng:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig NG no encontrado"
        )
    return serialize_jig_ng(jig_ng, include_jig=True, include_foto=True, db=db)

@router.post("/", response_model=JigNGSchema)
async def create_jig_ng(
    jig_ng_data: JigNGCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear nuevo jig NG"""
    # Verificar que el jig existe
    jig = db.query(Jig).filter(Jig.id == jig_ng_data.jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    # Verificar si ya existe un jig NG activo para este jig
    existing_ng = db.query(JigNG).filter(
        JigNG.jig_id == jig_ng_data.jig_id,
        JigNG.estado.in_(["pendiente", "en_reparacion"])
    ).first()
    
    if existing_ng:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un jig NG activo para este jig"
        )
    
    # Crear el jig NG
    db_jig_ng = JigNG(
        **jig_ng_data.dict(),
        tecnico_id=current_user.id
    )
    db.add(db_jig_ng)
    
    # Actualizar estado del jig a "reparacion"
    jig.estado = "reparacion"
    
    try:
        db.commit()
        db.refresh(db_jig_ng)
    except Exception as commit_error:
        error_str = str(commit_error)
        # Si es un error de llave duplicada, intentar corregir la secuencia y reintentar
        if "UniqueViolation" in error_str and "jigs_ng_pkey" in error_str:
            logger.warning("⚠️ Error de llave duplicada detectado en jigs_ng. Corrigiendo secuencia...")
            try:
                from sqlalchemy import text
                db.rollback()  # Rollback de la transacción actual
                
                # Obtener el máximo ID actual
                max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM jigs_ng"))
                max_id = max_id_result.scalar()
                
                # Actualizar la secuencia al siguiente valor disponible
                db.execute(text(f"SELECT setval('jigs_ng_id_seq', {max_id}, true)"))
                db.commit()
                logger.info(f"✅ Secuencia jigs_ng_id_seq corregida a {max_id + 1}. Reintentando crear jig NG...")
                
                # Recrear el jig NG con la secuencia corregida
                db_jig_ng = JigNG(
                    **jig_ng_data.dict(),
                    tecnico_id=current_user.id
                )
                db.add(db_jig_ng)
                jig.estado = "reparacion"
                
                # Reintentar el commit
                db.commit()
                db.refresh(db_jig_ng)
                logger.info("✅ Jig NG creado exitosamente después de corregir secuencia")
            except Exception as retry_error:
                logger.error(f"❌ Error al reintentar después de corregir secuencia: {retry_error}")
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error creando jig NG después de corregir secuencia: {str(retry_error)}"
                )
        else:
            # Si es otro tipo de error, hacer rollback y relanzar
            db.rollback()
            logger.error(f"❌ Error creando jig NG: {commit_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creando jig NG: {str(commit_error)}"
            )
    
    return serialize_jig_ng(db_jig_ng)

@router.put("/{jig_ng_id}", response_model=JigNGSchema)
async def update_jig_ng(
    jig_ng_id: int,
    jig_ng_data: JigNGUpdate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar jig NG (principalmente para marcar como reparado)"""
    jig_ng = db.query(JigNG).filter(JigNG.id == jig_ng_id).first()
    if not jig_ng:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig NG no encontrado"
        )
    
    # Actualizar campos
    for field, value in jig_ng_data.dict(exclude_unset=True).items():
        setattr(jig_ng, field, value)
    
    # Si se marca como reparado o falso defecto, actualizar fechas y técnico
    if jig_ng_data.estado == "reparado" or jig_ng_data.estado == "falso_defecto":
        from datetime import datetime
        if jig_ng_data.estado == "reparado":
            jig_ng.fecha_reparacion = datetime.utcnow()
            jig_ng.tecnico_reparacion_id = current_user.id
        # Eliminar la foto cuando se marca como reparado o falso defecto
        jig_ng.foto = None
        
        # Cambiar estado del jig a "activo" para que pueda ser validado nuevamente
        jig = db.query(Jig).filter(Jig.id == jig_ng.jig_id).first()
        if jig:
            jig.estado = "activo"
    
    db.commit()
    db.refresh(jig_ng)
    
    return serialize_jig_ng(jig_ng, include_jig=True, db=db)

@router.delete("/{jig_ng_id}")
async def delete_jig_ng(
    jig_ng_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar jig NG (solo si está descartado)"""
    jig_ng = db.query(JigNG).filter(JigNG.id == jig_ng_id).first()
    if not jig_ng:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig NG no encontrado"
        )
    
    if jig_ng.estado != "descartado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden eliminar jigs NG descartados"
        )
    
    db.delete(jig_ng)
    db.commit()
    
    return {"message": "Jig NG eliminado correctamente"}

@router.get("/stats/summary")
async def get_ng_stats(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener estadísticas de jigs NG"""
    try:
        # Usar una sola consulta con group by para optimizar
        from sqlalchemy import func
        
        stats = db.query(
            JigNG.estado,
            func.count(JigNG.id).label('count')
        ).group_by(JigNG.estado).all()
        
        # Inicializar contadores
        result = {
            "total": 0,
            "pendientes": 0,
            "en_reparacion": 0,
            "reparados": 0,
            "descartados": 0
        }
        
        # Procesar resultados
        for estado, count in stats:
            result["total"] += count
            if estado in result:
                result[estado] = count
        
        return result
        
    except Exception as e:
        print(f"Error obteniendo estadísticas NG: {e}")
        # Retornar valores por defecto en caso de error
        return {
            "total": 0,
            "pendientes": 0,
            "en_reparacion": 0,
            "reparados": 0,
            "descartados": 0
        }

@router.get("/stats/diagnostic")
async def get_diagnostic_info(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Información de diagnóstico para la base de datos"""
    try:
        from sqlalchemy import text
        
        # Información básica de la tabla
        total_records = db.query(JigNG).count()
        
        # Obtener información de la secuencia
        sequence_query = text("""
            SELECT last_value, is_called 
            FROM jigs_ng_id_seq
        """)
        sequence_result = db.execute(sequence_query).fetchone()
        
        # Obtener el máximo ID actual
        max_id_query = text("SELECT COALESCE(MAX(id), 0) FROM jigs_ng")
        max_id_result = db.execute(max_id_query).scalar()
        
        # Verificar si hay índices
        index_query = text("""
            SELECT indexname, tablename 
            FROM pg_indexes 
            WHERE tablename = 'jigs_ng' 
            AND indexname LIKE 'idx_%'
        """)
        
        indexes = db.execute(index_query).fetchall()
        
        # Tamaño de la tabla
        size_query = text("""
            SELECT pg_size_pretty(pg_total_relation_size('jigs_ng')) as table_size
        """)
        
        size_result = db.execute(size_query).fetchone()
        
        # Verificar si la secuencia está desincronizada
        last_value = sequence_result[0] if sequence_result else 0
        is_called = sequence_result[1] if sequence_result else False
        next_value = last_value if not is_called else last_value + 1
        sequence_synced = (next_value > max_id_result)
        
        return {
            "total_records": total_records,
            "max_id": max_id_result,
            "sequence_last_value": last_value,
            "sequence_next_value": next_value,
            "sequence_synced": sequence_synced,
            "indexes_count": len(indexes),
            "indexes": [{"name": idx[0], "table": idx[1]} for idx in indexes],
            "table_size": size_result[0] if size_result else "N/A",
            "status": "healthy" if (total_records < 10000 and sequence_synced) else "needs_optimization"
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "error"
        }

@router.post("/fix-sequence")
async def fix_jigs_ng_sequence(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Corregir la secuencia de jigs_ng si está desincronizada (útil para administradores)"""
    try:
        from sqlalchemy import text
        
        # Verificar que el usuario sea administrador o ingeniero
        if current_user.tipo_usuario not in ["ingeniero", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo administradores e ingenieros pueden corregir secuencias"
            )
        
        # Obtener el máximo ID actual
        max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM jigs_ng"))
        max_id = max_id_result.scalar()
        
        # Obtener el valor actual de la secuencia
        current_seq_query = text("SELECT last_value, is_called FROM jigs_ng_id_seq")
        current_seq = db.execute(current_seq_query).fetchone()
        old_value = current_seq[0] if current_seq else 0
        
        # Actualizar la secuencia al siguiente valor disponible
        db.execute(text(f"SELECT setval('jigs_ng_id_seq', {max_id}, true)"))
        db.commit()
        
        # Obtener el nuevo valor
        new_seq_query = text("SELECT last_value FROM jigs_ng_id_seq")
        new_value = db.execute(new_seq_query).scalar()
        
        logger.info(f"✅ Secuencia jigs_ng_id_seq corregida de {old_value} a {new_value}")
        
        return {
            "success": True,
            "message": f"Secuencia corregida exitosamente",
            "old_sequence_value": old_value,
            "new_sequence_value": new_value,
            "max_id": max_id,
            "next_id_will_be": new_value + 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error corrigiendo secuencia: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error corrigiendo secuencia: {str(e)}"
        )
