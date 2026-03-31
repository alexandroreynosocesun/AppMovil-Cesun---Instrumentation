"""
FCT Agent — captura zonas específicas de la pantalla con OCR local
y envía solo los valores numéricos al backend.

── INSTALACIÓN ────────────────────────────────────────────────────
  1. Instala Python: https://python.org
  2. Instala Tesseract: https://github.com/UB-Mannheim/tesseract/wiki
     (ruta default: C:\Program Files\Tesseract-OCR\tesseract.exe)
  3. pip install mss pillow requests pytesseract opencv-python numpy

── USO DIRECTO (con Python instalado) ────────────────────────────
  python fct_agent.py             # modo producción
  python fct_agent.py --calibrar  # verificar zonas

── COMPILAR a .exe (opcional) ────────────────────────────────────
  Corre build_exe.bat

── DETECTAR COORDENADAS ──────────────────────────────────────────
  python detect_zones.py          # genera deteccion.png con zonas
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
#  CONFIG — ajusta estas coordenadas a tu pantalla
#  Formato: (x, y, ancho, alto) en píxeles desde esquina superior izquierda
#  TIP: corre detect_zones.py para detectar coordenadas automáticamente
# ══════════════════════════════════════════════════════════════════
CONFIG = {
    "backend_url":  "https://api.checkconfirm.com/api/mes/captura",
    "estacion_id":  "FCT-1",
    "intervalo":    60,       # segundos entre capturas
    "monitor":      1,        # 1 = monitor principal

    # Zonas de captura (x, y, w, h) — resolución 1920x1080
    # ── Estación A (panel izquierdo) ──────────────────────────────
    "zona_modelo_a":   ( 20, 140, 700,  35),   # barra amarilla modelo A
    "zona_ok_a":       (890, 228,  90,  35),   # valor OKCount A (≈x=926)
    "zona_ng_a":       (890, 258,  95,  35),   # valor NGCount A
    "zona_pass_a":     (855, 293, 120,  28),   # valor Pass(%) A

    # ── Estación B (panel derecho) ────────────────────────────────
    "zona_ok_b":       (1855, 228, 100,  35),  # valor OKCount B (142 en x=1886)
    "zona_ng_b":       (1870, 258,  75,  35),  # valor NGCount B (22 en x=1897)
    "zona_pass_b":     (1840, 293, 110,  28),  # valor Pass(%) B (86.6% en x=1861)
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
    """Extrae número de una imagen BGR usando Tesseract."""
    h, w = img_bgr.shape[:2]
    img_bgr = cv2.resize(img_bgr, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
    gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    config = "--psm 7 -c tessedit_char_whitelist=0123456789."

    # Intentar con threshold normal, invertido y sin threshold
    # para cubrir fondos oscuros, fondos rojos (NG) y fondos claros
    for metodo in [
        lambda g: cv2.threshold(g, 150, 255, cv2.THRESH_BINARY)[1],
        lambda g: cv2.threshold(g, 150, 255, cv2.THRESH_BINARY_INV)[1],
        lambda g: cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2),
        lambda g: g,  # sin preprocesamiento
    ]:
        img_proc = metodo(gris)
        texto = pytesseract.image_to_string(img_proc, config=config).strip()
        numero = re.search(r"\d+(?:\.\d+)?", texto)
        if numero:
            return texto
    return ""


def ocr_texto(img_bgr):
    """Extrae texto libre de una imagen BGR usando Tesseract."""
    h, w = img_bgr.shape[:2]
    img_bgr = cv2.resize(img_bgr, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)

    gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, binaria = cv2.threshold(gris, 150, 255, cv2.THRESH_BINARY)

    config = "--psm 7"
    texto = pytesseract.image_to_string(binaria, config=config).strip()
    return texto


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
            k: capturar_zona(sct, monitor, CONFIG[k])
            for k in ("zona_modelo_a", "zona_ok_a", "zona_ng_a", "zona_pass_a",
                      "zona_ok_b", "zona_ng_b", "zona_pass_b")
        }

    if debug:
        import os
        os.makedirs("debug_zonas", exist_ok=True)
        for k, img in imgs.items():
            cv2.imwrite(f"debug_zonas/{k}.png", img)
        log.info("Imágenes de zonas guardadas en carpeta debug_zonas/")

    textos = {}
    textos["zona_modelo_a"] = ocr_texto(imgs["zona_modelo_a"])
    for k in ("zona_ok_a", "zona_ng_a", "zona_pass_a",
              "zona_ok_b", "zona_ng_b", "zona_pass_b"):
        textos[k] = ocr_numero(imgs[k])

    log.debug(f"OCR raw: {textos}")

    modelo = textos["zona_modelo_a"][:60] if textos["zona_modelo_a"] else None
    ok_a   = limpiar_numero(textos["zona_ok_a"])
    ng_a   = limpiar_numero(textos["zona_ng_a"])
    pass_a = limpiar_numero(textos["zona_pass_a"])
    ok_b   = limpiar_numero(textos["zona_ok_b"])
    ng_b   = limpiar_numero(textos["zona_ng_b"])
    pass_b = limpiar_numero(textos["zona_pass_b"])

    payload = {
        "estacion_id": CONFIG["estacion_id"],
        "modelo":      modelo,
        "estacion_a":  {"ok": int(ok_a) if ok_a is not None else None,
                        "ng": int(ng_a) if ng_a is not None else None,
                        "pass_pct": pass_a},
        "estacion_b":  {"ok": int(ok_b) if ok_b is not None else None,
                        "ng": int(ng_b) if ng_b is not None else None,
                        "pass_pct": pass_b},
    }

    try:
        resp = requests.post(CONFIG["backend_url"], json=payload, timeout=15)
        if resp.status_code == 200:
            log.info(
                f"OK — modelo={modelo} "
                f"A: ok={int(ok_a) if ok_a else '?'} ng={int(ng_a) if ng_a else '?'} pass={pass_a}% "
                f"B: ok={int(ok_b) if ok_b else '?'} ng={int(ng_b) if ng_b else '?'} pass={pass_b}%"
            )
        else:
            log.warning(f"Backend {resp.status_code}: {resp.text[:200]}")
    except requests.exceptions.ConnectionError:
        log.error("Sin conexión al backend")
    except Exception as e:
        log.error(f"Error enviando datos: {e}")


def calibrar():
    """Guarda 'calibracion.png' con las zonas marcadas para verificar posición."""
    with mss.mss() as sct:
        monitor = sct.monitors[CONFIG["monitor"]]
        shot = sct.grab(monitor)
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    draw = ImageDraw.Draw(img)
    colores = {
        "zona_modelo_a": "yellow",
        "zona_ok_a":     "lime",
        "zona_ng_a":     "red",
        "zona_pass_a":   "cyan",
        "zona_ok_b":     "lime",
        "zona_ng_b":     "red",
        "zona_pass_b":   "cyan",
    }
    for key, color in colores.items():
        x, y, w, h = CONFIG[key]
        draw.rectangle([x, y, x + w, y + h], outline=color, width=2)
        draw.text((x + 2, y + 2), key.replace("zona_", ""), fill=color)

    img.save("calibracion.png")
    log.info("Guardado 'calibracion.png' — verifica que las zonas estén sobre los valores correctos.")


def main():
    if "--calibrar" in sys.argv:
        calibrar()
        return

    debug = "--debug" in sys.argv
    log.info(f"FCT Agent iniciado — estacion={CONFIG['estacion_id']} intervalo={CONFIG['intervalo']}s")
    log.info(f"Backend: {CONFIG['backend_url']}")

    while True:
        capturar_y_enviar(debug=debug)
        if debug:
            log.info("Modo debug: solo una captura. Revisa carpeta debug_zonas/")
            break
        time.sleep(CONFIG["intervalo"])


if __name__ == "__main__":
    main()
