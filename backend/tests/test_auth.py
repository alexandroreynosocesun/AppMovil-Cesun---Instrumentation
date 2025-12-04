"""
Tests para endpoints de autenticación
"""
import pytest
from fastapi import status


def test_login_success(client, test_user):
    """Test de login exitoso"""
    response = client.post(
        "/api/auth/login",
        json={"usuario": "testuser", "password": "testpass123"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "tecnico" in data
    assert data["tecnico"]["usuario"] == "testuser"


def test_login_invalid_credentials(client, test_user):
    """Test de login con credenciales inválidas"""
    response = client.post(
        "/api/auth/login",
        json={"usuario": "testuser", "password": "wrongpass"}
    )
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_login_nonexistent_user(client):
    """Test de login con usuario inexistente"""
    response = client.post(
        "/api/auth/login",
        json={"usuario": "nonexistent", "password": "anypass"}
    )
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user(client, auth_token):
    """Test de obtener usuario actual"""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["usuario"] == "testuser"


def test_get_current_user_no_token(client):
    """Test de obtener usuario sin token"""
    response = client.get("/api/auth/me")
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_current_user_invalid_token(client):
    """Test de obtener usuario con token inválido"""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid_token"}
    )
    
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_register_solicitud(client):
    """Test de registro de solicitud"""
    response = client.post(
        "/api/registro/",
        json={
            "usuario": "newuser",
            "nombre": "Nuevo Usuario",
            "numero_empleado": "99999",
            "password": "newpass123",
            "tipo_usuario": "tecnico"
        }
    )
    
    # El endpoint puede devolver 200 o 201 dependiendo de la implementación
    assert response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
    data = response.json()
    assert data["usuario"] == "newuser"
    assert data["estado"] == "pendiente"
