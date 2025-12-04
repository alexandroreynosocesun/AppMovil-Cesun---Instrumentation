from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import DamagedLabel as DamagedLabelModel, Tecnico
from app.schemas import DamagedLabelCreate, DamagedLabelUpdate, DamagedLabel, PaginatedResponse
from app.routers.auth import get_current_user
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/damaged-labels", tags=["damaged-labels"])

@router.post("/", response_model=DamagedLabel)
def create_damaged_label(
    damaged_label_data: DamagedLabelCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear reporte de etiqueta NG dañada"""
    # Usuarios de gestión y técnicos pueden crear reportes
    if current_user.tipo_usuario not in ['gestion', 'Gestion', 'tecnico', 'validaciones']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo usuarios de gestión y técnicos pueden reportar etiquetas NG"
        )
    
    # Guardar la imagen como Base64 directamente en la BD
    # Crear el reporte
    db_damaged_label = DamagedLabelModel(
        modelo=damaged_label_data.modelo,
        tipo_jig=damaged_label_data.tipo_jig,
        numero_jig=damaged_label_data.numero_jig,
        foto=damaged_label_data.foto,  # Guardar Base64 directamente
        reportado_por_id=current_user.id,
        estado="pendiente"
    )
    
    db.add(db_damaged_label)
    db.commit()
    db.refresh(db_damaged_label)
    
    # Agregar información del usuario que reportó
    damaged_label_dict = {
        "id": db_damaged_label.id,
        "modelo": db_damaged_label.modelo,
        "tipo_jig": db_damaged_label.tipo_jig,
        "numero_jig": db_damaged_label.numero_jig,
        "foto": db_damaged_label.foto,
        "reportado_por_id": db_damaged_label.reportado_por_id,
        "estado": db_damaged_label.estado,
        "created_at": db_damaged_label.created_at,
        "reportado_por": {
            "id": current_user.id,
            "nombre": current_user.nombre,
            "numero_empleado": current_user.numero_empleado
        }
    }
    
    return damaged_label_dict

@router.get("/", response_model=PaginatedResponse[DamagedLabel])
def get_damaged_labels(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener reportes de etiquetas NG dañadas con paginación
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    """
    # Solo usuarios de gestión pueden ver los reportes
    if current_user.tipo_usuario not in ['gestion', 'Gestion']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo usuarios de gestión pueden ver los reportes de etiquetas NG"
        )
    
    from app.utils.pagination import paginate_query
    
    query = db.query(DamagedLabelModel).order_by(DamagedLabelModel.created_at.desc())
    items, total, pages = paginate_query(query, page, page_size)
    
    # Agregar información del usuario que reportó
    result = []
    for label in items:
        reportado_por = db.query(Tecnico).filter(Tecnico.id == label.reportado_por_id).first()
        label_dict = {
            "id": label.id,
            "modelo": label.modelo,
            "tipo_jig": label.tipo_jig,
            "numero_jig": label.numero_jig,
            "foto": label.foto,
            "reportado_por_id": label.reportado_por_id,
            "estado": label.estado,
            "created_at": label.created_at,
            "reportado_por": {
                "id": reportado_por.id,
                "nombre": reportado_por.nombre,
                "numero_empleado": reportado_por.numero_empleado
            } if reportado_por else None
        }
        result.append(label_dict)
    
    return PaginatedResponse(
        items=result,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.put("/{damaged_label_id}", response_model=DamagedLabel)
def update_damaged_label(
    damaged_label_id: int,
    damaged_label_data: DamagedLabelUpdate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar estado de un reporte de etiqueta NG"""
    # Solo usuarios de gestión pueden actualizar reportes
    if current_user.tipo_usuario not in ['gestion', 'Gestion']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo usuarios de gestión pueden actualizar reportes"
        )
    
    db_damaged_label = db.query(DamagedLabelModel).filter(DamagedLabelModel.id == damaged_label_id).first()
    if not db_damaged_label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reporte de etiqueta NG no encontrado"
        )
    
    if damaged_label_data.estado:
        db_damaged_label.estado = damaged_label_data.estado
        # Si el estado cambia a "resuelto", borrar la foto
        if damaged_label_data.estado == "resuelto":
            db_damaged_label.foto = None
            print(f"🗑️ Foto eliminada para etiqueta {damaged_label_id} (estado: resuelto)")
    
    db.commit()
    db.refresh(db_damaged_label)
    
    # Agregar información del usuario que reportó
    reportado_por = db.query(Tecnico).filter(Tecnico.id == db_damaged_label.reportado_por_id).first()
    damaged_label_dict = {
        "id": db_damaged_label.id,
        "modelo": db_damaged_label.modelo,
        "tipo_jig": db_damaged_label.tipo_jig,
        "numero_jig": db_damaged_label.numero_jig,
        "foto": db_damaged_label.foto,
        "reportado_por_id": db_damaged_label.reportado_por_id,
        "estado": db_damaged_label.estado,
        "created_at": db_damaged_label.created_at,
        "reportado_por": {
            "id": reportado_por.id,
            "nombre": reportado_por.nombre,
            "numero_empleado": reportado_por.numero_empleado
        } if reportado_por else None
    }
    
    return damaged_label_dict

