"""
Configuración compartida para tests
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db, Base
from app.models.models import Tecnico
from app.auth import get_password_hash
from main import app

# Base de datos en memoria para tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Crear base de datos de prueba para cada test"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Cliente de prueba con base de datos override"""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    """Crear usuario de prueba"""
    user = Tecnico(
        usuario="testuser",
        nombre="Usuario de Prueba",
        numero_empleado="12345",
        password_hash=get_password_hash("testpass123"),
        tipo_usuario="tecnico",
        activo=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_user(db):
    """Crear usuario administrador de prueba"""
    admin = Tecnico(
        usuario="admin",
        nombre="Administrador",
        numero_empleado="00000",
        password_hash=get_password_hash("admin123"),
        tipo_usuario="admin",
        activo=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def auth_token(client, test_user):
    """Obtener token de autenticación para tests"""
    response = client.post(
        "/api/auth/login",
        json={"usuario": "testuser", "password": "testpass123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def admin_token(client, admin_user):
    """Obtener token de administrador para tests"""
    response = client.post(
        "/api/auth/login",
        json={"usuario": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]
