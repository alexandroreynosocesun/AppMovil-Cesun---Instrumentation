"""
Utilidades para paginación de resultados
"""
from typing import TypeVar, Generic, List
from sqlalchemy.orm import Query
from sqlalchemy import func
from fastapi import Query as FastAPIQuery
from app.schemas import PaginatedResponse

T = TypeVar('T')

def paginate_query(
    query: Query,
    page: int = 1,
    page_size: int = 20
) -> tuple[List, int, int]:
    """
    Paginar una consulta de SQLAlchemy
    
    Args:
        query: Consulta de SQLAlchemy
        page: Número de página (empezando en 1)
        page_size: Tamaño de página
        
    Returns:
        Tupla con (items, total, pages)
    """
    # Validar parámetros
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20
    if page_size > 100:
        page_size = 100  # Límite máximo
    
    # Obtener total de registros
    total = query.count()
    
    # Calcular número de páginas
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # Obtener items paginados
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return items, total, pages


def create_paginated_response(
    items: List[T],
    total: int,
    page: int,
    page_size: int,
    pages: int,
    schema_class
) -> PaginatedResponse:
    """
    Crear respuesta paginada
    
    Args:
        items: Lista de items
        total: Total de registros
        page: Página actual
        page_size: Tamaño de página
        pages: Total de páginas
        schema_class: Clase del schema para serializar items
        
    Returns:
        Respuesta paginada
    """
    serialized_items = []
    for item in items:
        if hasattr(schema_class, 'from_orm'):
            serialized_items.append(schema_class.from_orm(item))
        elif hasattr(item, 'dict'):
            serialized_items.append(schema_class(**item.dict()))
        else:
            serialized_items.append(schema_class(**item))
    
    return PaginatedResponse(
        items=serialized_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


# Parámetros de paginación para FastAPI
def pagination_params(
    page: int = FastAPIQuery(1, ge=1, description="Número de página"),
    page_size: int = FastAPIQuery(20, ge=1, le=100, description="Tamaño de página (máximo 100)")
):
    """
    Parámetros de paginación para endpoints FastAPI
    
    Returns:
        Tupla (page, page_size)
    """
    return page, page_size

