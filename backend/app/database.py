from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool
import os
from dotenv import load_dotenv

load_dotenv()

# Configuración de la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL debe estar configurado en el archivo .env. "
        "Ejemplo: postgresql+psycopg2://usuario:password@localhost:5432/jigs_validation"
    )
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Configuración del engine según el tipo de base de datos
if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL:
    # PostgreSQL para producción
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Verificar conexiones antes de usarlas
        echo=ENVIRONMENT == "development"  # Log SQL en desarrollo
    )
elif "sqlite" in DATABASE_URL:
    # SQLite para desarrollo
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=NullPool
    )
else:
    # Otros tipos de base de datos
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Obtener sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
