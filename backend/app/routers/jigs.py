from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
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
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener lista paginada de jigs
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    
    Retorna una respuesta paginada con los jigs disponibles.
    """
    query = db.query(Jig).order_by(Jig.created_at.desc())
    items, total, pages = paginate_query(query, page, page_size)
    
    return PaginatedResponse(
        items=[JigSchema.from_orm(jig) for jig in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

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
    
    jig = db.query(Jig).filter(Jig.codigo_qr == codigo_qr).first()
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
    
    result = JigHistorial(
        jig=JigSchema.from_orm(jig),
        validaciones=validaciones_schema,
        reparaciones=reparaciones_schema,
        jigs_ng=jigs_ng_schema
    )
    
    # Guardar en caché (5 minutos para datos que cambian frecuentemente)
    cache_service.set(cache_key, result.dict(), ttl=300)
    
    return result

@router.get("/{jig_id}", response_model=JigSchema)
async def get_jig_by_id(
    jig_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener jig por ID"""
    jig = db.query(Jig).filter(Jig.id == jig_id).first()
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
