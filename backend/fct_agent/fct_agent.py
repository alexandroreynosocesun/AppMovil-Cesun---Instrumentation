"""
FCT Agent — captura screenshot de la estación FCT cada N segundos
y lo envía al backend para análisis OCR con Claude Vision.

Compilar a .exe (en una PC con Python):
  pip install mss pillow requests
  pyinstaller --onefile --noconsole fct_agent.py

Configurar:
  - BACKEND_URL: URL del backend
  - ESTACION_ID: nombre de esta estación (ej. FCT-1)
  - INTERVALO: segundos entre capturas
"""
import sys
import time
import io
import logging
import requests
from PIL import ImageGrab  # incluido en Pillow para Windows

# ── CONFIGURACIÓN ─────────────────────────────────────────
BACKEND_URL  = "https://cesun-instrumentation-doebfjmi5.vercel.app/api/mes/captura"
ESTACION_ID  = "FCT-1"
INTERVALO    = 60        # segundos entre capturas (60 para producción)
LOG_FILE     = "fct_agent.log"
# ──────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


def capturar_y_enviar():
    try:
        # Capturar pantalla completa
        img = ImageGrab.grab()

        # Convertir a bytes PNG
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        # Enviar al backend
        resp = requests.post(
            BACKEND_URL,
            files={"imagen": ("screenshot.png", buf, "image/png")},
            data={"estacion_id": ESTACION_ID},
            timeout=30,
        )

        if resp.status_code == 200:
            d = resp.json()
            log.info(
                f"OK — modelo={d.get('modelo')} "
                f"A: {d['estacion_a']['ok']}/{d['estacion_a']['ng']} ({d['estacion_a']['pass_pct']}%) "
                f"B: {d['estacion_b']['ok']}/{d['estacion_b']['ng']} ({d['estacion_b']['pass_pct']}%)"
            )
        else:
            log.warning(f"Backend respondió {resp.status_code}: {resp.text[:200]}")

    except requests.exceptions.ConnectionError:
        log.error("No se pudo conectar al backend — verificar red/VPN")
    except Exception as e:
        log.error(f"Error inesperado: {e}")


def main():
    log.info(f"FCT Agent iniciado — estacion={ESTACION_ID} intervalo={INTERVALO}s")
    log.info(f"Backend: {BACKEND_URL}")

    while True:
        capturar_y_enviar()
        time.sleep(INTERVALO)


if __name__ == "__main__":
    main()
