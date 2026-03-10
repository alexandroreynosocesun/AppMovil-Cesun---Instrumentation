from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, NullPool
import os
from dotenv import load_dotenv

load_dotenv()

UPH_DATABASE_URL = os.getenv("UPH_DATABASE_URL")
if not UPH_DATABASE_URL:
    raise ValueError(
        "UPH_DATABASE_URL debe estar configurado en el archivo .env. "
        "Ejemplo: postgresql+psycopg2://usuario:password@localhost:5432/uph_produccion"
    )

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if "postgresql" in UPH_DATABASE_URL or "postgres" in UPH_DATABASE_URL:
    uph_engine = create_engine(
        UPH_DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        echo=ENVIRONMENT == "development"
    )
elif "sqlite" in UPH_DATABASE_URL:
    uph_engine = create_engine(
        UPH_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=NullPool
    )
else:
    uph_engine = create_engine(UPH_DATABASE_URL)

UphSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=uph_engine)

UphBase = declarative_base()


def get_uph_db():
    """Obtener sesión de base de datos UPH"""
    db = UphSessionLocal()
    try:
        yield db
    finally:
        db.close()
