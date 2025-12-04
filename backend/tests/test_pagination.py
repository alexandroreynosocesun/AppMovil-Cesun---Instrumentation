"""
Tests para funcionalidad de paginación
"""
import pytest
from app.utils.pagination import paginate_query
from sqlalchemy.orm import Query
from unittest.mock import Mock


def test_paginate_query_basic():
    """Test básico de paginación"""
    # Mock de query
    mock_query = Mock()
    mock_query.count.return_value = 100
    mock_query.offset.return_value.limit.return_value.all.return_value = list(range(20))
    
    items, total, pages = paginate_query(mock_query, page=1, page_size=20)
    
    assert total == 100
    assert pages == 5  # 100 / 20 = 5 páginas
    assert len(items) == 20
    mock_query.count.assert_called_once()
    mock_query.offset.assert_called_once_with(0)
    mock_query.offset.return_value.limit.assert_called_once_with(20)


def test_paginate_query_page_2():
    """Test de paginación en página 2"""
    mock_query = Mock()
    mock_query.count.return_value = 100
    mock_query.offset.return_value.limit.return_value.all.return_value = list(range(20, 40))
    
    items, total, pages = paginate_query(mock_query, page=2, page_size=20)
    
    assert total == 100
    assert pages == 5
    mock_query.offset.assert_called_once_with(20)  # (2-1) * 20 = 20


def test_paginate_query_invalid_page():
    """Test de paginación con página inválida (debe corregirse a 1)"""
    mock_query = Mock()
    mock_query.count.return_value = 50
    mock_query.offset.return_value.limit.return_value.all.return_value = list(range(20))
    
    items, total, pages = paginate_query(mock_query, page=0, page_size=20)
    
    # La página debe corregirse a 1
    mock_query.offset.assert_called_once_with(0)


def test_paginate_query_max_page_size():
    """Test de paginación con page_size mayor al máximo (debe limitarse a 100)"""
    mock_query = Mock()
    mock_query.count.return_value = 500
    mock_query.offset.return_value.limit.return_value.all.return_value = list(range(100))
    
    items, total, pages = paginate_query(mock_query, page=1, page_size=200)
    
    # Debe limitarse a 100
    mock_query.offset.return_value.limit.assert_called_once_with(100)


def test_paginate_query_empty_results():
    """Test de paginación con resultados vacíos"""
    mock_query = Mock()
    mock_query.count.return_value = 0
    mock_query.offset.return_value.limit.return_value.all.return_value = []
    
    items, total, pages = paginate_query(mock_query, page=1, page_size=20)
    
    assert total == 0
    assert pages == 0
    assert len(items) == 0

