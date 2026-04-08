"""
Servidor UPH - escucha en 172.29.67.223:5000
Solo recibe eventos de PCs de linea (sin internet, VLAN 66/67)
"""
import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
import csv
from pathlib import Path

load_dotenv()

from app.database_uph import get_uph_db
from app.models.uph_models import EventoUPH
from sqlalchemy.orm import Session

app = FastAPI(title="UPH Server", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPH_CSV_DIR = Path(__file__).parent / "uph_logs"
UPH_CSV_DIR.mkdir(exist_ok=True)


class EventoIn(BaseModel):
    linea: str
    estacion: str
    evento: str
    contador: Optional[int] = None
    timestamp: Optional[str] = None


def _append_csv(linea, estacion, evento, contador, ts):
    fecha = ts.strftime("%Y%m%d")
    archivo = UPH_CSV_DIR / f"uph_backup_{fecha}.csv"
    escribir_header = not archivo.exists()
    with open(archivo, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if escribir_header:
            writer.writerow(["timestamp", "linea", "estacion", "evento", "contador"])
        writer.writerow([ts.isoformat(), linea, estacion, evento, contador])


@app.post("/evento", status_code=201)
@app.post("/api/uph/evento", status_code=201)
def recibir_evento(evento: EventoIn, db: Session = Depends(get_uph_db)):
    if evento.evento != "GOOD":
        return {"ok": False, "detalle": "Solo se registran GOOD"}

    ts = datetime.now(timezone.utc)
    registro = EventoUPH(
        linea=evento.linea,
        estacion=evento.estacion,
        evento=evento.evento,
        contador=evento.contador,
        timestamp=ts,
    )
    db.add(registro)
    db.commit()
    _append_csv(evento.linea, evento.estacion, evento.evento, evento.contador, ts)
    print(f"[{ts.strftime('%H:%M:%S')}] OK  {evento.linea} | {evento.estacion} | cnt={evento.contador}")
    return {"ok": True, "id": registro.id}


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def index():
    from fastapi.responses import HTMLResponse
    return HTMLResponse("<h1>UPH Server corriendo</h1><p>Puerto 5000 - OK</p>")


if __name__ == "__main__":
    print("=" * 50)
    print("  UPH Server - Puerto 5000")
    print("  IP: 172.29.67.188:5000")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
