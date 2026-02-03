from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct
from typing import List
from ..database import get_db
from ..models.models import Jig, Validacion, Reparacion, JigNG
from ..schemas import Jig as JigSchema, JigCreate, JigHistorial, Validacion as ValidacionSchema, Reparacion as ReparacionSchema, JigNG as JigNGSchema, PaginatedResponse
from ..auth import get_current_user
from ..models.models import Tecnico
from ..services.cache_service import cache_service
from ..utils.pagination import paginate_query
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.get("/", response_model=PaginatedResponse[JigSchema])
async def get_jigs(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=1500, description="Tamaño de página (máximo 1500)"),
    search: str = Query(None, description="Búsqueda por número, modelo, tipo o QR"),
    tipo: str = Query(None, description="Filtrar por tipo de jig"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener lista paginada de jigs

    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 1500)

    Retorna una respuesta paginada con los jigs disponibles.
    """
    query = db.query(Jig).options(joinedload(Jig.tecnico_ultima_validacion))
    if tipo:
        query = query.filter(Jig.tipo == tipo)
    if search:
        search_like = f"%{search.strip()}%"
        query = query.filter(
            Jig.numero_jig.ilike(search_like) |
            Jig.modelo_actual.ilike(search_like) |
            Jig.tipo.ilike(search_like) |
            Jig.codigo_qr.ilike(search_like)
        )
    query = query.order_by(Jig.created_at.desc())
    items, total, pages = paginate_query(query, page, page_size)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/modelos", response_model=List[str])
async def get_modelos(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener lista de modelos únicos disponibles en los jigs
    
    Retorna una lista de strings con los modelos únicos que tienen los jigs registrados.
    (Endpoint mantenido para compatibilidad hacia atrás)
    """
    # Obtener modelos únicos y no nulos de la tabla jigs
    modelos = db.query(func.distinct(Jig.modelo_actual)).filter(
        Jig.modelo_actual.isnot(None),
        Jig.modelo_actual != ''
    ).order_by(Jig.modelo_actual).all()
    
    # Extraer los valores de las tuplas
    modelos_list = [modelo[0] for modelo in modelos if modelo[0]]
    
    return modelos_list

@router.get("/modelos-con-tipos")
async def get_modelos_con_tipos(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener modelos con sus tipos disponibles
    
    Retorna un diccionario donde las claves son los nombres de los modelos
    y los valores son listas de tipos disponibles para ese modelo.
    Ejemplo: {
        "ABC123": ["manual", "semiautomatico", "nuevo_semiautomatico"],
        "XYZ789": ["manual", "semiautomatico"]
    }
    """
    from collections import defaultdict
    
    # Obtener todos los jigs con modelo y tipo no nulos
    jigs = db.query(Jig.modelo_actual, Jig.tipo).filter(
        Jig.modelo_actual.isnot(None),
        Jig.modelo_actual != '',
        Jig.tipo.isnot(None),
        Jig.tipo != ''
    ).all()
    
    # Agrupar tipos por modelo
    modelos_tipos = defaultdict(set)
    for modelo, tipo in jigs:
        modelos_tipos[modelo].add(tipo)
    
    # Convertir sets a listas ordenadas
    resultado = {}
    for modelo in sorted(modelos_tipos.keys()):
        # Ordenar tipos: manual primero, luego semiautomatico, luego nuevo_semiautomatico, luego otros
        tipos_ordenados = sorted(modelos_tipos[modelo], key=lambda x: (
            0 if x == 'manual' else 
            1 if x == 'semiautomatico' else 
            2 if x == 'nuevo_semiautomatico' or x == 'new_semiautomatico' else 
            3
        ))
        resultado[modelo] = tipos_ordenados
    
    return resultado

@router.get("/qr/{codigo_qr}", response_model=JigHistorial, summary="Obtener jig por código QR", description="""
    Obtener información completa de un jig mediante su código QR.
    
    Incluye:
    - Información del jig (código QR, número, tipo, estado)
    - Historial completo de validaciones
    - Historial de reparaciones
    - Historial de jigs NG (No Conformes)
    
    Este endpoint utiliza caché para mejorar el rendimiento.
    
    **Parámetros:**
    - `codigo_qr`: Código QR del jig a consultar
    """)
async def get_jig_by_qr(
    codigo_qr: str,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jig por código QR con historial (con caché)"""
    # Intentar obtener del caché
    cache_key = f"jig:qr:{codigo_qr}"
    cached_result = cache_service.get(cache_key)
    if cached_result:
        from ..services.monitoring_service import track_cache_hit
        track_cache_hit(cache_key)
        return JigHistorial(**cached_result)
    
    from ..services.monitoring_service import track_cache_miss
    track_cache_miss(cache_key)

    jig = db.query(Jig).options(joinedload(Jig.tecnico_ultima_validacion)).filter(Jig.codigo_qr == codigo_qr).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    # Obtener validaciones, reparaciones y jigs NG
    validaciones = db.query(Validacion).filter(Validacion.jig_id == jig.id).all()
    reparaciones = db.query(Reparacion).filter(Reparacion.jig_id == jig.id).all()
    jigs_ng = db.query(JigNG).filter(JigNG.jig_id == jig.id).all()
    
    # Convertir a esquemas Pydantic
    validaciones_schema = [ValidacionSchema.from_orm(v) for v in validaciones]
    reparaciones_schema = [ReparacionSchema.from_orm(r) for r in reparaciones]
    
    # Serializar jigs_ng manualmente para manejar las relaciones
    jigs_ng_schema = []
    for jig_ng in jigs_ng:
        jig_ng_dict = {
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
        jigs_ng_schema.append(jig_ng_dict)
    
    # Serializar el jig manualmente para asegurar que tecnico_ultima_validacion sea un dict
    jig_dict = JigSchema.from_orm(jig).model_dump()
    if jig.tecnico_ultima_validacion:
        jig_dict['tecnico_ultima_validacion'] = {
            'id': jig.tecnico_ultima_validacion.id,
            'nombre': jig.tecnico_ultima_validacion.nombre,
            'numero_empleado': jig.tecnico_ultima_validacion.numero_empleado,
            'usuario': jig.tecnico_ultima_validacion.usuario
        }

    result = JigHistorial(
        jig=jig_dict,
        validaciones=validaciones_schema,
        reparaciones=reparaciones_schema,
        jigs_ng=jigs_ng_schema
    )

    # Guardar en caché (5 minutos para datos que cambian frecuentemente)
    cache_service.set(cache_key, result.model_dump(), ttl=300)
    
    return result

@router.get("/{jig_id}", response_model=JigSchema)
async def get_jig_by_id(
    jig_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jig por ID"""
    jig = db.query(Jig).options(joinedload(Jig.tecnico_ultima_validacion)).filter(Jig.id == jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    return jig

@router.post("/", response_model=JigSchema)
async def create_jig(
    jig_data: JigCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear nuevo jig"""
    # Verificar si el código QR ya existe
    existing_jig = db.query(Jig).filter(Jig.codigo_qr == jig_data.codigo_qr).first()
    if existing_jig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código QR ya existe"
        )
    
    db_jig = Jig(**jig_data.dict())
    db.add(db_jig)
    db.commit()
    db.refresh(db_jig)
    
    # Invalidar caché relacionado
    cache_service.delete_pattern("jig:*")
    
    return JigSchema.from_orm(db_jig)

@router.put("/{jig_id}", response_model=JigSchema)
async def update_jig(
    jig_id: int,
    jig_data: JigCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar jig existente"""
    jig = db.query(Jig).filter(Jig.id == jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    for field, value in jig_data.dict().items():
        setattr(jig, field, value)
    
    db.commit()
    db.refresh(jig)
    
    # Invalidar caché relacionado
    cache_service.delete_pattern(f"jig:qr:{jig.codigo_qr}")
    cache_service.delete_pattern("jig:*")
    
    return JigSchema.from_orm(jig)

@router.delete("/all")
async def delete_all_jigs(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar TODOS los jigs (solo para administradores - TEMPORAL PARA TESTING)"""
    # Verificar que el usuario sea administrador
    if current_user.tipo_usuario != "admin" and current_user.usuario not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden eliminar todos los jigs"
        )
    
    try:
        from sqlalchemy import text
        
        # Contar jigs antes de eliminar
        total_jigs = db.query(Jig).count()
        
        if total_jigs == 0:
            return {
                "message": "No hay jigs para eliminar",
                "deleted_count": 0
            }
        
        # Eliminar primero todas las relaciones
        # Eliminar jigs NG asociados
        db.query(JigNG).filter(JigNG.jig_id.in_(db.query(Jig.id))).delete(synchronize_session=False)
        
        # Eliminar reparaciones asociadas
        db.query(Reparacion).filter(Reparacion.jig_id.in_(db.query(Jig.id))).delete(synchronize_session=False)
        
        # Eliminar validaciones asociadas
        db.query(Validacion).filter(Validacion.jig_id.in_(db.query(Jig.id))).delete(synchronize_session=False)
        
        # Eliminar todos los jigs
        deleted_count = db.query(Jig).delete()
        
        db.commit()
        
        # Resetear la secuencia después del commit
        db.execute(text("SELECT setval('jigs_id_seq', 0, false)"))
        db.commit()
        
        logger.info(f"⚠️ TODOS LOS JIGS ELIMINADOS por {current_user.usuario}. Total: {deleted_count}")
        
        return {
            "message": f"Todos los jigs eliminados correctamente",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error al eliminar todos los jigs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar todos los jigs: {str(e)}"
        )

@router.delete("/{jig_id}")
async def delete_jig(
    jig_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar jig (hard delete)"""
    jig = db.query(Jig).filter(Jig.id == jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    try:
        # Eliminar primero todas las validaciones asociadas
        db.query(Validacion).filter(Validacion.jig_id == jig_id).delete()
        
        # Eliminar todas las reparaciones asociadas
        db.query(Reparacion).filter(Reparacion.jig_id == jig_id).delete()
        
        # Eliminar todos los jigs NG asociados
        db.query(JigNG).filter(JigNG.jig_id == jig_id).delete()
        
        # Finalmente eliminar el jig
        db.delete(jig)
        db.commit()
        
        return {"message": "Jig eliminado correctamente"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar jig: {str(e)}"
        )

@router.post("/fix-sequence")
async def fix_jigs_sequence(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Corregir la secuencia de jigs si está desincronizada (útil para administradores)"""
    try:
        from sqlalchemy import text
        
        # Verificar que el usuario sea administrador o ingeniero
        if current_user.tipo_usuario not in ["ingeniero", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo administradores e ingenieros pueden corregir secuencias"
            )
        
        # Obtener el máximo ID actual
        max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM jigs"))
        max_id = max_id_result.scalar()
        
        # Obtener el valor actual de la secuencia
        current_seq_query = text("SELECT last_value, is_called FROM jigs_id_seq")
        current_seq = db.execute(current_seq_query).fetchone()
        old_value = current_seq[0] if current_seq else 0
        
        # Actualizar la secuencia al siguiente valor disponible
        db.execute(text(f"SELECT setval('jigs_id_seq', {max_id}, true)"))
        db.commit()
        
        # Obtener el nuevo valor
        new_seq_query = text("SELECT last_value FROM jigs_id_seq")
        new_value = db.execute(new_seq_query).scalar()
        
        logger.info(f"✅ Secuencia jigs_id_seq corregida de {old_value} a {new_value}")
        
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
