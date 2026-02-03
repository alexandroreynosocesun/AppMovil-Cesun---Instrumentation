from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..models.models import ArduinoSequence, Tecnico
from ..schemas import ArduinoSequence as ArduinoSequenceSchema, ArduinoSequenceCreate, ArduinoSequenceUpdate, PaginatedResponse
from ..auth import get_current_user
from ..utils.pagination import paginate_query

router = APIRouter()

def normalize_pais(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    tokens = [token.strip().upper() for token in value.replace(';', ',').replace('|', ',').replace('/', ',').replace(' ', ',').split(',')]
    tokens = [token for token in tokens if token]
    if not tokens:
        return None
    return ",".join(dict.fromkeys(tokens))


def ensure_admin_or_engineer(current_user: Tecnico):
    if current_user.tipo_usuario not in ["admin", "ingeniero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores o ingenieros pueden modificar secuencias."
        )


@router.get("/", response_model=PaginatedResponse[ArduinoSequenceSchema])
async def get_sequences(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    modelo: Optional[str] = None,
    modelo_interno: Optional[str] = None,
    pais: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    print(f"🔍 Buscando: modelo={modelo}, modelo_interno={modelo_interno}, pais={pais}")

    # Verificar total de registros
    total_count = db.query(ArduinoSequence).count()
    print(f"📊 Total registros en BD: {total_count}")

    query = db.query(ArduinoSequence)
    if modelo:
        # Buscar por coincidencia parcial en cualquier parte del modelo
        search_term = modelo.strip()
        print(f"🔎 Buscando modelo con ILIKE '%{search_term}%'")
        query = query.filter(ArduinoSequence.modelo.ilike(f"%{search_term}%"))
    if modelo_interno:
        query = query.filter(ArduinoSequence.modelo_interno == modelo_interno)
    if pais:
        query = query.filter(ArduinoSequence.pais.ilike(f"%{pais.upper()}%"))

    query = query.order_by(ArduinoSequence.modelo.asc(), ArduinoSequence.destino.asc())
    items, total, pages = paginate_query(query, page, page_size)

    return PaginatedResponse(
        items=[ArduinoSequenceSchema.from_orm(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.post("/", response_model=ArduinoSequenceSchema, status_code=status.HTTP_201_CREATED)
async def create_sequence(
    sequence_data: ArduinoSequenceCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    ensure_admin_or_engineer(current_user)
    payload = sequence_data.dict()
    if payload.get("pais"):
        payload["pais"] = normalize_pais(payload["pais"])
    sequence = ArduinoSequence(**payload)
    db.add(sequence)
    db.commit()
    db.refresh(sequence)
    return ArduinoSequenceSchema.from_orm(sequence)


@router.put("/{sequence_id}", response_model=ArduinoSequenceSchema)
async def update_sequence(
    sequence_id: int,
    sequence_data: ArduinoSequenceUpdate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    ensure_admin_or_engineer(current_user)
    sequence = db.query(ArduinoSequence).filter(ArduinoSequence.id == sequence_id).first()
    if not sequence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado")

    update_data = sequence_data.dict(exclude_unset=True)
    if update_data.get("pais"):
        update_data["pais"] = normalize_pais(update_data["pais"])
    for key, value in update_data.items():
        setattr(sequence, key, value)
    db.commit()
    db.refresh(sequence)
    return ArduinoSequenceSchema.from_orm(sequence)


@router.delete("/{sequence_id}", status_code=status.HTTP_200_OK)
async def delete_sequence(
    sequence_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    ensure_admin_or_engineer(current_user)
    sequence = db.query(ArduinoSequence).filter(ArduinoSequence.id == sequence_id).first()
    if not sequence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado")
    db.delete(sequence)
    db.commit()
    return {"message": "Registro eliminado", "id": sequence_id}
