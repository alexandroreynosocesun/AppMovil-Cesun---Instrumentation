"""
Tests para endpoints de validaciones
"""
import pytest
from fastapi import status
from datetime import datetime

from app.models.models import Jig, Validacion


@pytest.fixture
def test_jig(db):
    """Crear jig de prueba"""
    jig = Jig(
        codigo_qr="TEST_QR_001",
        numero_jig="1",
        tipo="manual",
        estado="activo"
    )
    db.add(jig)
    db.commit()
    db.refresh(jig)
    return jig


def test_create_validation(client, auth_token, test_user, test_jig):
    """Test de crear validación"""
    response = client.post(
        "/api/validations/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "jig_id": test_jig.id,
            "turno": "A",
            "estado": "OK",
            "comentario": "Validación de prueba",
            "cantidad": 1
        }
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["estado"] == "OK"
    assert data["jig_id"] == test_jig.id
    assert data["tecnico_id"] == test_user.id


def test_create_validation_no_jig(client, auth_token, test_user):
    """Test de crear validación sin jig (asignación)"""
    response = client.post(
        "/api/validations/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "turno": "A",
            "estado": "OK",
            "comentario": "Validación sin jig",
            "cantidad": 1
        }
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["estado"] == "OK"
    assert data["jig_id"] is None


def test_get_validations(client, auth_token, test_user, test_jig, db):
    """Test de obtener lista de validaciones"""
    # Crear validación de prueba con tecnico_asignado_id para que el técnico la vea
    validation = Validacion(
        jig_id=test_jig.id,
        tecnico_id=test_user.id,
        tecnico_asignado_id=test_user.id,  # Importante: técnicos solo ven las asignadas a ellos
        turno="A",
        estado="OK",
        cantidad=1
    )
    db.add(validation)
    db.commit()
    
    response = client.get(
        "/api/validations/",
        headers={"Authorization": f"Bearer {auth_token}"},
        params={"page": 1, "page_size": 20}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert len(data["items"]) > 0


def test_get_validations_pagination(client, auth_token, test_user, test_jig, db):
    """Test de paginación en validaciones"""
    # Crear múltiples validaciones con tecnico_asignado_id
    for i in range(25):
        validation = Validacion(
            jig_id=test_jig.id,
            tecnico_id=test_user.id,
            tecnico_asignado_id=test_user.id,  # Importante: técnicos solo ven las asignadas a ellos
            turno="A",
            estado="OK",
            cantidad=1
        )
        db.add(validation)
    db.commit()
    
    # Primera página
    response = client.get(
        "/api/validations/",
        headers={"Authorization": f"Bearer {auth_token}"},
        params={"page": 1, "page_size": 20}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["items"]) == 20
    assert data["total"] >= 25
    assert data["pages"] >= 2


def test_get_validations_filter_by_jig(client, auth_token, test_user, test_jig, db):
    """Test de filtrar validaciones por jig"""
    # Crear validación para el jig
    validation = Validacion(
        jig_id=test_jig.id,
        tecnico_id=test_user.id,
        turno="A",
        estado="OK",
        cantidad=1
    )
    db.add(validation)
    db.commit()
    
    response = client.get(
        "/api/validations/",
        headers={"Authorization": f"Bearer {auth_token}"},
        params={"jig_id": test_jig.id, "page": 1, "page_size": 20}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert all(v["jig_id"] == test_jig.id for v in data["items"])

