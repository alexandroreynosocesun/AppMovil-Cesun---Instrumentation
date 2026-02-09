"""
Router para seed/carga masiva de datos desde CSVs.
Endpoints para poblar arduino_sequences y modelos_mainboard_conector.
"""
import csv
import os
import re
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from ..database import get_db
from ..models.models import ArduinoSequence, ModeloMainboardConector, Tecnico
from ..auth import get_current_user
from ..utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

# ---------- Helpers ----------

def extract_pais(sequence_name: str) -> Optional[str]:
    """Extraer país(es) del nombre de la secuencia Arduino."""
    name = sequence_name.upper()
    if '_MEX_GUA' in name:
        return 'MEX,GUA'
    if '_COL' in name:
        return 'COL'
    if '_MEX' in name:
        return 'MEX'
    if '_GUA' in name:
        return 'GUA'
    if '_US' in name:
        return 'US'
    if 'ROKU' in name or 'FIRETV' in name or 'HISENSE' in name:
        return 'US'
    return None


def split_model(model_str: str):
    """
    Separar 'modelo-modelo_interno' en (modelo, modelo_interno).
    Usa el último guion como separador.
    Ej: '53061-50A60QUA(01)' -> ('53061', '50A60QUA(01)')
        'T950R4T.PB701-40A40QUR' -> ('T950R4T.PB701', '40A40QUR')
    """
    model_str = model_str.strip()
    if not model_str:
        return None, None
    last_hyphen = model_str.rfind('-')
    if last_hyphen == -1:
        return model_str, model_str
    return model_str[:last_hyphen], model_str[last_hyphen + 1:]


def parse_minisop6_csv(csv_content: str):
    """
    Parsear MiniSOP-6 CSV y retornar lista de dicts para arduino_sequences.
    El CSV tiene dos mitades lado a lado (izquierda cols 0-5, derecha cols 6-11).
    """
    records = []
    reader = csv.reader(StringIO(csv_content))

    # Saltar header
    try:
        next(reader)
    except StopIteration:
        return records

    for row in reader:
        if len(row) < 5:
            continue

        # Procesar mitad izquierda (cols 0-4)
        _process_half(row, 0, records)

        # Procesar mitad derecha (cols 6-10) si existen
        if len(row) > 10:
            _process_half(row, 6, records)

    return records


def _process_half(row, offset, records):
    """Procesar una mitad (izquierda o derecha) de una fila del MiniSOP-6 CSV."""
    selection = row[offset].strip() if len(row) > offset else ""
    sequence = row[offset + 1].strip() if len(row) > offset + 1 else ""
    models_cell = row[offset + 4].strip() if len(row) > offset + 4 else ""

    # Solo procesar filas con Selection (son headers de bloque)
    if not selection or not sequence:
        return
    # Saltar entradas sin modelos (NORMAL, EXIT, etc.)
    if not models_cell:
        return

    pais = extract_pais(sequence)

    # Los modelos pueden estar separados por newlines dentro de la celda
    model_lines = [m.strip() for m in models_cell.split('\n') if m.strip()]

    for model_line in model_lines:
        modelo, modelo_interno = split_model(model_line)
        if modelo and modelo_interno:
            records.append({
                "comando": selection,
                "destino": sequence,
                "pais": pais,
                "modelo": modelo,
                "modelo_interno": modelo_interno,
            })


def parse_pcb_csv(csv_content: str):
    """
    Parsear PCB information CSV y retornar datos agregados para modelos_mainboard_conector.
    Agrega modelo_interno y tool_sw por (nombre_conector, modelo_mainboard).
    """
    reader = csv.reader(StringIO(csv_content))

    # Saltar header (puede ser multi-línea en el CSV)
    try:
        next(reader)
    except StopIteration:
        return []

    # Agregar por (nombre_conector, modelo_mainboard)
    aggregated = {}

    for row in reader:
        if len(row) < 19:
            continue

        modelo_interno = row[1].strip() if row[1] else ""
        modelo_mainboard = row[4].strip() if row[4] else ""
        nombre_conector = row[16].strip() if row[16] else ""
        tool_type = row[17].strip() if len(row) > 17 and row[17] else ""  # TOOL (ej: MINI LVDS, SKD)
        tool_sw = row[18].strip() if len(row) > 18 and row[18] else ""    # TOOL SW (ej: Mini08, Mini18)

        # Saltar filas sin datos esenciales
        if not modelo_mainboard or not nombre_conector:
            continue
        if nombre_conector in ('/', '\\', ''):
            continue

        key = (nombre_conector, modelo_mainboard)
        if key not in aggregated:
            aggregated[key] = {
                "nombre_conector": nombre_conector,
                "modelo_mainboard": modelo_mainboard,
                "modelos_internos": set(),
                "tools_sw": set(),
            }

        if modelo_interno and modelo_interno != '/':
            aggregated[key]["modelos_internos"].add(modelo_interno)
        # Guardar TOOL y TOOL SW por separado
        if tool_type and tool_type != '/':
            aggregated[key]["tools_sw"].add(tool_type)
        if tool_sw and tool_sw != '/':
            aggregated[key]["tools_sw"].add(tool_sw)

    # Convertir sets a strings separados por coma
    results = []
    for data in aggregated.values():
        results.append({
            "nombre_conector": data["nombre_conector"],
            "modelo_mainboard": data["modelo_mainboard"],
            "modelo_interno": ", ".join(sorted(data["modelos_internos"])) if data["modelos_internos"] else None,
            "tool_sw": ", ".join(sorted(data["tools_sw"])) if data["tools_sw"] else None,
        })

    return results


# ---------- Endpoints ----------

def ensure_admin(current_user: Tecnico):
    if current_user.tipo_usuario not in ["admin", "superadmin", "ingeniero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o ingenieros pueden ejecutar seed."
        )


@router.post("/arduino-sequences")
async def seed_arduino_sequences(
    clear_existing: bool = Query(True, description="Eliminar registros existentes antes de insertar"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Poblar arduino_sequences desde MiniSOP-6(Full).csv"""
    ensure_admin(current_user)

    # Buscar CSV en varias ubicaciones posibles
    csv_path = _find_csv("MiniSOP-6(Full).csv")
    if not csv_path:
        raise HTTPException(status_code=404, detail="No se encontró MiniSOP-6(Full).csv")

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()

    records = parse_minisop6_csv(content)
    if not records:
        raise HTTPException(status_code=400, detail="No se encontraron registros en el CSV")

    if clear_existing:
        deleted = db.query(ArduinoSequence).delete()
        logger.info(f"Eliminados {deleted} registros existentes de arduino_sequences")

    inserted = 0
    skipped = 0
    for rec in records:
        # Verificar duplicados
        exists = db.query(ArduinoSequence).filter(
            ArduinoSequence.comando == rec["comando"],
            ArduinoSequence.modelo == rec["modelo"],
            ArduinoSequence.modelo_interno == rec["modelo_interno"],
        ).first()

        if exists:
            skipped += 1
            continue

        seq = ArduinoSequence(**rec)
        db.add(seq)
        inserted += 1

    db.commit()
    logger.info(f"Seed arduino_sequences: {inserted} insertados, {skipped} duplicados omitidos")

    return {
        "message": "Seed de arduino_sequences completado",
        "inserted": inserted,
        "skipped": skipped,
        "total_parsed": len(records),
    }


@router.post("/mainboard-info")
async def seed_mainboard_info(
    clear_existing: bool = Query(True, description="Eliminar registros existentes antes de insertar"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Poblar modelos_mainboard_conector desde PCB CSV"""
    ensure_admin(current_user)

    # Asegurar que las columnas sean TEXT (migración puede no haberse corrido)
    try:
        db.execute(text("ALTER TABLE modelos_mainboard_conector ALTER COLUMN modelo_interno TYPE TEXT"))
        db.execute(text("ALTER TABLE modelos_mainboard_conector ALTER COLUMN tool_sw TYPE TEXT"))
        db.commit()
        logger.info("Columnas modelo_interno y tool_sw expandidas a TEXT")
    except Exception:
        db.rollback()  # Ya son TEXT, ignorar

    csv_path = _find_csv("New PCB information for HI-2025-12-3 (1)(New Pcb).csv")
    if not csv_path:
        raise HTTPException(status_code=404, detail="No se encontró el CSV de PCB information")

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()

    records = parse_pcb_csv(content)
    if not records:
        raise HTTPException(status_code=400, detail="No se encontraron registros en el CSV")

    if clear_existing:
        deleted = db.query(ModeloMainboardConector).delete()
        logger.info(f"Eliminados {deleted} registros existentes de modelos_mainboard_conector")

    inserted = 0
    skipped = 0
    for rec in records:
        exists = db.query(ModeloMainboardConector).filter(
            ModeloMainboardConector.nombre_conector == rec["nombre_conector"],
            ModeloMainboardConector.modelo_mainboard == rec["modelo_mainboard"],
        ).first()

        if exists:
            # Actualizar modelo_interno y tool_sw si ya existe
            if rec["modelo_interno"]:
                existing_internos = set(exists.modelo_interno.split(", ")) if exists.modelo_interno else set()
                new_internos = set(rec["modelo_interno"].split(", "))
                combined = existing_internos | new_internos
                exists.modelo_interno = ", ".join(sorted(combined))
            if rec["tool_sw"]:
                existing_tools = set(exists.tool_sw.split(", ")) if exists.tool_sw else set()
                new_tools = set(rec["tool_sw"].split(", "))
                combined = existing_tools | new_tools
                exists.tool_sw = ", ".join(sorted(combined))
            skipped += 1
            continue

        entry = ModeloMainboardConector(**rec)
        db.add(entry)
        inserted += 1

    db.commit()
    logger.info(f"Seed mainboard_info: {inserted} insertados, {skipped} actualizados")

    return {
        "message": "Seed de mainboard info completado",
        "inserted": inserted,
        "updated": skipped,
        "total_parsed": len(records),
    }


@router.post("/all")
async def seed_all(
    clear_existing: bool = Query(True, description="Eliminar registros existentes antes de insertar"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Poblar ambas tablas (arduino_sequences y mainboard_info)"""
    ensure_admin(current_user)

    results = {}

    # Seed Arduino sequences
    try:
        csv_path = _find_csv("MiniSOP-6(Full).csv")
        if csv_path:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            records = parse_minisop6_csv(content)

            if clear_existing:
                db.query(ArduinoSequence).delete()

            inserted = 0
            for rec in records:
                exists = db.query(ArduinoSequence).filter(
                    ArduinoSequence.comando == rec["comando"],
                    ArduinoSequence.modelo == rec["modelo"],
                    ArduinoSequence.modelo_interno == rec["modelo_interno"],
                ).first()
                if not exists:
                    db.add(ArduinoSequence(**rec))
                    inserted += 1

            results["arduino_sequences"] = {"inserted": inserted, "total_parsed": len(records)}
        else:
            results["arduino_sequences"] = {"error": "CSV no encontrado"}
    except Exception as e:
        results["arduino_sequences"] = {"error": str(e)}

    # Seed Mainboard info
    try:
        csv_path = _find_csv("New PCB information for HI-2025-12-3 (1)(New Pcb).csv")
        if csv_path:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            records = parse_pcb_csv(content)

            if clear_existing:
                db.query(ModeloMainboardConector).delete()

            inserted = 0
            for rec in records:
                exists = db.query(ModeloMainboardConector).filter(
                    ModeloMainboardConector.nombre_conector == rec["nombre_conector"],
                    ModeloMainboardConector.modelo_mainboard == rec["modelo_mainboard"],
                ).first()
                if not exists:
                    db.add(ModeloMainboardConector(**rec))
                    inserted += 1

            results["mainboard_info"] = {"inserted": inserted, "total_parsed": len(records)}
        else:
            results["mainboard_info"] = {"error": "CSV no encontrado"}
    except Exception as e:
        results["mainboard_info"] = {"error": str(e)}

    db.commit()
    logger.info(f"Seed all completado: {results}")

    return {
        "message": "Seed completo",
        "results": results,
    }


# ---------- Bulk import via JSON ----------

@router.post("/bulk/arduino-sequences")
async def bulk_import_arduino_sequences(
    data: List[dict],
    clear_existing: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Importar arduino_sequences desde JSON. Cada item: {comando, destino, pais, modelo, modelo_interno}"""
    ensure_admin(current_user)

    if clear_existing:
        db.query(ArduinoSequence).delete()

    inserted = 0
    errors = []
    for i, item in enumerate(data):
        try:
            required = ["comando", "destino", "modelo", "modelo_interno"]
            missing = [f for f in required if f not in item or not item[f]]
            if missing:
                errors.append({"index": i, "error": f"Campos faltantes: {missing}"})
                continue

            seq = ArduinoSequence(
                comando=item["comando"],
                destino=item["destino"],
                pais=item.get("pais"),
                modelo=item["modelo"],
                modelo_interno=item["modelo_interno"],
            )
            db.add(seq)
            inserted += 1
        except Exception as e:
            errors.append({"index": i, "error": str(e)})

    db.commit()
    return {"inserted": inserted, "errors": errors}


@router.post("/bulk/mainboard-info")
async def bulk_import_mainboard_info(
    data: List[dict],
    clear_existing: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Importar modelos_mainboard_conector desde JSON. Cada item: {nombre_conector, modelo_mainboard, modelo_interno, tool_sw}"""
    ensure_admin(current_user)

    if clear_existing:
        db.query(ModeloMainboardConector).delete()

    inserted = 0
    errors = []
    for i, item in enumerate(data):
        try:
            required = ["nombre_conector", "modelo_mainboard"]
            missing = [f for f in required if f not in item or not item[f]]
            if missing:
                errors.append({"index": i, "error": f"Campos faltantes: {missing}"})
                continue

            entry = ModeloMainboardConector(
                nombre_conector=item["nombre_conector"],
                modelo_mainboard=item["modelo_mainboard"],
                modelo_interno=item.get("modelo_interno"),
                tool_sw=item.get("tool_sw"),
            )
            db.add(entry)
            inserted += 1
        except Exception as e:
            errors.append({"index": i, "error": str(e)})

    db.commit()
    return {"inserted": inserted, "errors": errors}


# ---------- Upload CSV ----------

@router.post("/upload/arduino-sequences")
async def upload_arduino_csv(
    file: UploadFile = File(...),
    clear_existing: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Subir CSV de MiniSOP-6 y poblar arduino_sequences"""
    ensure_admin(current_user)

    content = await file.read()
    text = content.decode('utf-8-sig')
    records = parse_minisop6_csv(text)

    if not records:
        raise HTTPException(status_code=400, detail="No se encontraron registros en el CSV")

    if clear_existing:
        db.query(ArduinoSequence).delete()

    inserted = 0
    for rec in records:
        db.add(ArduinoSequence(**rec))
        inserted += 1

    db.commit()
    return {"message": "Upload completado", "inserted": inserted}


@router.post("/upload/mainboard-info")
async def upload_mainboard_csv(
    file: UploadFile = File(...),
    clear_existing: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user),
):
    """Subir CSV de PCB information y poblar modelos_mainboard_conector"""
    ensure_admin(current_user)

    content = await file.read()
    text = content.decode('utf-8-sig')
    records = parse_pcb_csv(text)

    if not records:
        raise HTTPException(status_code=400, detail="No se encontraron registros en el CSV")

    if clear_existing:
        db.query(ModeloMainboardConector).delete()

    inserted = 0
    for rec in records:
        db.add(ModeloMainboardConector(**rec))
        inserted += 1

    db.commit()
    return {"message": "Upload completado", "inserted": inserted}


# ---------- Utils ----------

def _find_csv(filename: str) -> Optional[str]:
    """Buscar CSV en varias ubicaciones posibles."""
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), filename),  # backend/
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), filename),  # project root
        os.path.join("/app", filename),  # Docker container
        os.path.join("/app/data", filename),  # Docker container data dir
        filename,  # Current directory
    ]

    for path in possible_paths:
        if os.path.isfile(path):
            logger.info(f"CSV encontrado: {path}")
            return path

    logger.error(f"CSV no encontrado: {filename}. Buscado en: {possible_paths}")
    return None
