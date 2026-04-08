"""
Migración manual para modelos_uph:
- Agrega columnas: tipo, uph_hi1..uph_hi7
- Mantiene uph_total y linea_id para compatibilidad

Correr: python migrate_modelos_uph.py
"""
import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text

UPH_DATABASE_URL = os.getenv("UPH_DATABASE_URL")
if not UPH_DATABASE_URL:
    print("ERROR: UPH_DATABASE_URL no configurado en .env")
    sys.exit(1)

engine = create_engine(UPH_DATABASE_URL)

COLUMNAS_NUEVAS = [
    ("tipo",    "VARCHAR"),
    ("uph_hi1", "FLOAT"),
    ("uph_hi2", "FLOAT"),
    ("uph_hi3", "FLOAT"),
    ("uph_hi4", "FLOAT"),
    ("uph_hi5", "FLOAT"),
    ("uph_hi6", "FLOAT"),
    ("uph_hi7", "FLOAT"),
]

with engine.connect() as conn:
    # Ver columnas existentes
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='modelos_uph'"
    ))
    existentes = {row[0] for row in result}
    print(f"Columnas actuales: {existentes}")

    for col, tipo in COLUMNAS_NUEVAS:
        if col not in existentes:
            conn.execute(text(f"ALTER TABLE modelos_uph ADD COLUMN {col} {tipo}"))
            print(f"  ✅ Agregada columna: {col}")
        else:
            print(f"  ⏭  Ya existe: {col}")

    conn.commit()

print("\n✅ Migración completada.")
