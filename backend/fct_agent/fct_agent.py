"""
FCT Agent — captura Pass Rate de cada lado (A y B) y envía al backend.

── INSTALACIÓN ────────────────────────────────────────────────────
  1. Instala Python: https://python.org
  2. Instala Tesseract: https://github.com/UB-Mannheim/tesseract/wiki
     (ruta default: C:\Program Files\Tesseract-OCR\tesseract.exe)
  3. pip install mss pillow requests pytesseract opencv-python numpy

── USO ────────────────────────────────────────────────────────────
  python fct_agent.py             # modo producción
  python fct_agent.py --calibrar  # verificar zonas
  python fct_agent.py --debug     # captura única + guarda imágenes de zonas

── CAMBIAR ESTACIÓN ───────────────────────────────────────────────
  Edita "estacion_id" en CONFIG. Ejemplos: "FCT-608", "FCT-607"
  Cada PC FCT debe tener su propio estacion_id.
"""

import sys
import time
import re
import logging
import requests
import numpy as np
import cv2
import pytesseract
from PIL import Image, ImageDraw
import mss

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ══════════════════════════════════════════════════════════════════
#  CONFIG
#  ► Cambia "estacion_id" según la PC: "FCT-608", "FCT-607", etc.
#  ► "arranque" = segundos que espera al inicio antes de la primera
#    captura (da tiempo al lado A de estabilizarse)
# ══════════════════════════════════════════════════════════════════
CONFIG = {
    "backend_url":  "https://api.checkconfirm.com/api/mes/captura",
    "estacion_id":  "FCT-608",        # ← cambia esto en cada PC
    "intervalo":    60,               # segundos entre capturas
    "arranque":     15,               # segundos de espera al inicio
    "monitor":      1,                # 1 = monitor principal

    # Zonas de captura (x, y, w, h) — resolución 1920x1080
    # TIP: corre detect_zones.py para detectar coordenadas, --calibrar para verificar

    # ── Pass Rate (lo único que se envía actualmente) ──────────────
    "zona_pass_a":     (855, 293, 120,  28),   # valor Pass(%) lado A
    "zona_pass_b":     (1840, 293, 110,  28),  # valor Pass(%) lado B

    # ── OK y NG (comentados — descomentar si se necesitan en el futuro) ──
    # "zona_ok_a":    (890, 228,  90,  35),   # valor OKCount lado A
    # "zona_ng_a":    (890, 258,  95,  35),   # valor NGCount lado A
    # "zona_ok_b":    (1855, 228, 100,  35),  # valor OKCount lado B
    # "zona_ng_b":    (1870, 258,  75,  35),  # valor NGCount lado B

    # ── Modelo (informativo) ──────────────────────────────────────
    # "zona_modelo_a": (20, 140, 700, 35),    # barra amarilla modelo A
}
# ══════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("fct_agent.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


def capturar_zona(sct, monitor_info, zona):
    """Captura una zona y devuelve imagen BGR (numpy array)."""
    x, y, w, h = zona
    region = {
        "left":   monitor_info["left"] + x,
        "top":    monitor_info["top"]  + y,
        "width":  w,
        "height": h,
    }
    shot = sct.grab(region)
    img_np = np.array(shot)
    return cv2.cvtColor(img_np, cv2.COLOR_BGRA2BGR)


def ocr_numero(img_bgr):
    """Extrae número de una imagen BGR usando Tesseract.
    Prueba múltiples métodos de preprocesamiento para cubrir
    fondos oscuros, fondos rojos (estado NG) y fondos claros.
    """
    h, w = img_bgr.shape[:2]
    img_bgr = cv2.resize(img_bgr, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
    gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    config = "--psm 7 -c tessedit_char_whitelist=0123456789."

    for metodo in [
        lambda g: cv2.threshold(g, 150, 255, cv2.THRESH_BINARY)[1],
        lambda g: cv2.threshold(g, 150, 255, cv2.THRESH_BINARY_INV)[1],
        lambda g: cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2),
        lambda g: g,
    ]:
        img_proc = metodo(gris)
        texto = pytesseract.image_to_string(img_proc, config=config).strip()
        if re.search(r"\d+(?:\.\d+)?", texto):
            return texto
    return ""


def limpiar_numero(texto: str):
    """Extrae el primer número (entero o decimal) del texto OCR."""
    texto = texto.replace(",", ".").replace("O", "0").replace("o", "0")
    m = re.search(r"\d+(?:\.\d+)?", texto)
    if m:
        return float(m.group())
    return None


def capturar_y_enviar(debug=False):
    with mss.mss() as sct:
        monitor = sct.monitors[CONFIG["monitor"]]
        imgs = {
            "zona_pass_a": capturar_zona(sct, monitor, CONFIG["zona_pass_a"]),
            "zona_pass_b": capturar_zona(sct, monitor, CONFIG["zona_pass_b"]),
        }

    if debug:
        import os
        os.makedirs("debug_zonas", exist_ok=True)
        for k, img in imgs.items():
            cv2.imwrite(f"debug_zonas/{k}.png", img)
        log.info("Imágenes guardadas en debug_zonas/")

    pass_a = limpiar_numero(ocr_numero(imgs["zona_pass_a"]))
    pass_b = limpiar_numero(ocr_numero(imgs["zona_pass_b"]))

    payload = {
        "estacion_id": CONFIG["estacion_id"],
        "modelo":      None,
        "estacion_a":  {
            # "ok": None,   # descomentar si se reactiva captura OK/NG
            # "ng": None,
            "pass_pct": pass_a,
        },
        "estacion_b":  {
            # "ok": None,
            # "ng": None,
            "pass_pct": pass_b,
        },
    }

    try:
        resp = requests.post(CONFIG["backend_url"], json=payload, timeout=15)
        if resp.status_code == 200:
            log.info(f"OK — estacion={CONFIG['estacion_id']} | A: pass={pass_a}%  B: pass={pass_b}%")
        else:
            log.warning(f"Backend {resp.status_code}: {resp.text[:200]}")
    except requests.exceptions.ConnectionError:
        log.error("Sin conexión al backend")
    except Exception as e:
        log.error(f"Error enviando datos: {e}")


def calibrar():
    """Guarda 'calibracion.png' con las zonas de Pass% marcadas."""
    with mss.mss() as sct:
        monitor = sct.monitors[CONFIG["monitor"]]
        shot = sct.grab(monitor)
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    draw = ImageDraw.Draw(img)
    zonas_activas = {
        "zona_pass_a": "cyan",
        "zona_pass_b": "cyan",
    }
    for key, color in zonas_activas.items():
        x, y, w, h = CONFIG[key]
        draw.rectangle([x, y, x + w, y + h], outline=color, width=3)
        draw.text((x + 2, y + 2), key.replace("zona_", ""), fill=color)

    img.save("calibracion.png")
    log.info("Guardado 'calibracion.png'")


def main():
    if "--calibrar" in sys.argv:
        calibrar()
        return

    debug = "--debug" in sys.argv

    log.info(f"FCT Agent iniciado — estacion={CONFIG['estacion_id']} intervalo={CONFIG['intervalo']}s")
    log.info(f"Backend: {CONFIG['backend_url']}")

    if not debug:
        log.info(f"Esperando {CONFIG['arranque']}s para que la pantalla se estabilice...")
        time.sleep(CONFIG["arranque"])

    while True:
        capturar_y_enviar(debug=debug)
        if debug:
            log.info("Modo debug: captura única. Revisa carpeta debug_zonas/")
            break
        time.sleep(CONFIG["intervalo"])


if __name__ == "__main__":
    main()
