"""
Tests básicos para endpoints de jigs
"""
import pytest
from fastapi import status
from app.models.models import Jig
from app.auth import get_password_hash


@pytest.fixture
def sample_jig(db):
    """Crear un jig de ejemplo"""
    jig = Jig(
        codigo_qr="TEST123",
        numero_jig="JIG001",
        tipo="manual",
        estado="activo"
    )
    db.add(jig)
    db.commit()
    db.refresh(jig)
    return jig


def test_get_jigs_endpoint_requires_auth(client):
    """Verificar que el endpoint de jigs requiere autenticación"""
    response = client.get("/api/jigs/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_jigs_endpoint_with_invalid_token(client):
    """Test con token inválido"""
    response = client.get(
        "/api/jigs/",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_pagination_parameters_in_jigs_endpoint(client, db):
    """Verificar que el endpoint acepta parámetros de paginación"""
    from app.models.models import Tecnico
    from app.auth import create_access_token
    
    # Crear usuario de prueba
    user = Tecnico(
        usuario="testuser",
        nombre="Test User",
        numero_empleado="12345",
        password_hash=get_password_hash("password"),
        tipo_usuario="tecnico"
    )
    db.add(user)
    db.commit()
    
    # Crear token
    token = create_access_token(data={"sub": user.usuario})
    
    # Hacer request con parámetros de paginación
    response = client.get(
        "/api/jigs/?page=1&page_size=10",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    # Si la autenticación funciona, debería retornar 200 o 404 si no hay datos
    # Pero no debería ser 422 (unprocessable entity) por parámetros incorrectos
    assert response.status_code != status.HTTP_422_UNPROCESSABLE_ENTITY

