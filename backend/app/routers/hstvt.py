import httpx
from fastapi import APIRouter

router = APIRouter()

HSTVT_SERVER = "http://172.29.69.94:5001"


@router.get("/list")
def list_hstvt():
    """Lista todos los scripts .HStVt disponibles."""
    try:
        r = httpx.get(f"{HSTVT_SERVER}/scripts", timeout=5)
        return r.json()
    except Exception:
        return {"error": "PC de scripts no accesible", "scripts": [], "total": 0}


@router.get("/check")
def check_hstvt(modelo: str):
    """
    Verifica si existe un script para el modelo dado.
    Ejemplo: GET /api/hstvt/check?modelo=53806-55U75QUF-Q0209
    """
    try:
        r = httpx.get(f"{HSTVT_SERVER}/scripts/check", params={"modelo": modelo}, timeout=5)
        return r.json()
    except Exception:
        return {"error": "PC de scripts no accesible", "existe": False, "archivos": []}
