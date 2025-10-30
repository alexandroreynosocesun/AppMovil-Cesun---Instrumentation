from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.models import JigNG, Jig, Tecnico
from ..schemas import JigNG as JigNGSchema, JigNGCreate, JigNGUpdate
from ..auth import get_current_user

router = APIRouter()

def serialize_jig_ng(jig_ng, include_jig=False, db=None):
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

@router.get("/", response_model=List[JigNGSchema])
async def get_jigs_ng(
    skip: int = 0,
    limit: int = 100,
    estado: Optional[str] = None,
    categoria: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener lista de jigs NG con filtros opcionales"""
    from sqlalchemy.orm import joinedload
    
    query = db.query(JigNG).options(
        joinedload(JigNG.tecnico_ng),
        joinedload(JigNG.tecnico_reparacion),
        joinedload(JigNG.jig)
    )
    
    if estado:
        query = query.filter(JigNG.estado == estado)
    if categoria:
        query = query.filter(JigNG.categoria == categoria)
    
    jigs_ng = query.offset(skip).limit(limit).all()
    
    # Convertir a diccionario para incluir información de técnicos
    return [serialize_jig_ng(jig_ng, include_jig=True, db=db) for jig_ng in jigs_ng]

@router.get("/jig/{jig_id}", response_model=List[JigNGSchema])
async def get_jig_ng_by_jig_id(
    jig_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jigs NG por ID de jig"""
    jigs_ng = db.query(JigNG).filter(JigNG.jig_id == jig_id).all()
    return [serialize_jig_ng(jig_ng, include_jig=True, db=db) for jig_ng in jigs_ng]

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
    return serialize_jig_ng(jig_ng, include_jig=True, db=db)

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
    
    db.commit()
    db.refresh(db_jig_ng)
    
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
    
    # Si se marca como reparado, actualizar fechas y técnico
    if jig_ng_data.estado == "reparado":
        from datetime import datetime
        jig_ng.fecha_reparacion = datetime.utcnow()
        jig_ng.tecnico_reparacion_id = current_user.id
        
        # Cambiar estado del jig a "activo"
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
        
        return {
            "total_records": total_records,
            "indexes_count": len(indexes),
            "indexes": [{"name": idx[0], "table": idx[1]} for idx in indexes],
            "table_size": size_result[0] if size_result else "N/A",
            "status": "healthy" if total_records < 10000 else "needs_optimization"
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "error"
        }
