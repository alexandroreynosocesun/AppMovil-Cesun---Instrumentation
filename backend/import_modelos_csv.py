"""
Importa modelos UPH desde el CSV de AMI Capacity al DB de UPH.
Uso: python import_modelos_csv.py
"""
import csv
import glob
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.uph_models import ModeloUPH, UphBase

# Cargar .env para obtener UPH_DATABASE_URL
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DB_URL = os.getenv("UPH_DATABASE_URL")
if not DB_URL:
    print("ERROR: UPH_DATABASE_URL no encontrado en .env")
    sys.exit(1)

engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)
db = Session()

# Columnas UPH en el CSV: HI-1..HI-7
UPH_COLS = [65, 70, 75, 80, 85, 90, 95]

files = glob.glob(os.path.join(os.path.dirname(__file__), "AMI Capacity*.csv"))
if not files:
    print("ERROR: No se encontró el archivo AMI Capacity*.csv")
    sys.exit(1)

csv_file = files[0]
print(f"Leyendo CSV...")

insertados = 0
omitidos_sin_uph = 0
omitidos_duplicados = 0

with open(csv_file, encoding="utf-8-sig", errors="replace") as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        if i < 3:
            continue  # saltar encabezados

        nombre = row[4].strip() if len(row) > 4 else ""
        if not nombre:
            continue

        tipo = row[2].strip() if len(row) > 2 else None
        board = row[5].strip() if len(row) > 5 else None

        uphs = []
        for c in UPH_COLS:
            v = row[c].strip() if c < len(row) else ""
            try:
                uphs.append(float(v))
            except (ValueError, TypeError):
                uphs.append(None)

        # Omitir si no tiene ningún UPH válido
        if not any(u is not None for u in uphs):
            omitidos_sin_uph += 1
            continue

        # Omitir duplicados por nombre
        existe = db.query(ModeloUPH).filter(ModeloUPH.nombre == nombre).first()
        if existe:
            omitidos_duplicados += 1
            continue

        modelo = ModeloUPH(
            nombre=nombre,
            modelo_interno=board or None,
            tipo=tipo or None,
            uph_hi1=uphs[0],
            uph_hi2=uphs[1],
            uph_hi3=uphs[2],
            uph_hi4=uphs[3],
            uph_hi5=uphs[4],
            uph_hi6=uphs[5],
            uph_hi7=uphs[6],
            uph_total=next((u for u in uphs if u is not None), None),
        )
        db.add(modelo)
        insertados += 1

db.commit()
db.close()

print(f"\nResultado:")
print(f"  Insertados:           {insertados}")
print(f"  Sin UPH (omitidos):   {omitidos_sin_uph}")
print(f"  Duplicados (omitidos):{omitidos_duplicados}")
print("Importacion completada.")
