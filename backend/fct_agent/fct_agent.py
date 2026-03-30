"""
FCT Agent — captura zonas específicas de la pantalla con OCR local
y envía solo los valores numéricos al backend (sin imagen, sin Claude Vision).

── INSTALACIÓN (una sola vez, en una PC con Python) ──────────────
  pip install mss pillow requests winocr pyinstaller

── COMPILAR a .exe ───────────────────────────────────────────────
  pyinstaller --onefile --noconsole --name fct_agent fct_agent.py

── CALIBRACIÓN ───────────────────────────────────────────────────
  Ejecuta con --calibrar para guardar una imagen con las zonas
  marcadas y verificar que están bien posicionadas:
    fct_agent.exe --calibrar

── CONFIGURACIÓN ─────────────────────────────────────────────────
  Edita la sección CONFIG más abajo para ajustar coordenadas.
"""

import sys
import time
import re
import json
import logging
import asyncio
import requests
from PIL import Image, ImageDraw
import mss

# ══════════════════════════════════════════════════════════════════
#  CONFIG — ajusta estas coordenadas a tu pantalla
#  Formato: (x, y, ancho, alto) en píxeles desde esquina superior izquierda
#  TIP: usa --calibrar para ver las zonas marcadas en pantalla
# ══════════════════════════════════════════════════════════════════
CONFIG = {
    "backend_url":  "https://cesun-instrumentation-doebfjmi5.vercel.app/api/mes/captura",
    "estacion_id":  "FCT-1",
    "intervalo":    60,       # segundos entre capturas
    "monitor":      1,        # 1 = monitor principal

    # Zonas de captura (x, y, w, h)
    # ── Estación A (panel izquierdo) ──────────────────────────────
    "zona_modelo_a":   (130,  143, 580,  32),   # título del modelo est. A
    "zona_ok_a":       (1215, 183, 165,  28),   # valor OKCount est. A
    "zona_ng_a":       (1215, 207, 165,  28),   # valor NGCount est. A
    "zona_pass_a":     (1375, 207, 120,  28),   # valor Pass(%) est. A

    # ── Estación B (panel derecho) ─────────────────────────────────
    "zona_ok_b":       (2655, 183, 165,  28),   # valor OKCount est. B
    "zona_ng_b":       (2655, 207, 165,  28),   # valor NGCount est. B
    "zona_pass_b":     (2815, 207, 120,  28),   # valor Pass(%) est. B
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
    """Captura una zona de la pantalla y devuelve PIL Image."""
    x, y, w, h = zona
    region = {
        "left":   monitor_info["left"] + x,
        "top":    monitor_info["top"]  + y,
        "width":  w,
        "height": h,
    }
    shot = sct.grab(region)
    return Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")


async def ocr_zona(img: Image.Image) -> str:
    """Extrae texto de una imagen usando Windows OCR (sin instalación extra)."""
    try:
        import winocr
        result = await winocr.recognize_pil(img, "en")
        return result.get("text", "").strip()
    except Exception as e:
        log.warning(f"OCR falló: {e}")
        return ""


def limpiar_numero(texto: str) -> float | None:
    """Extrae el primer número (entero o decimal) del texto OCR."""
    # Quitar espacios y caracteres confundidos por OCR
    texto = texto.replace(",", ".").replace("O", "0").replace("o", "0")
    m = re.search(r"[\d]+(?:\.\d+)?", texto)
    if m:
        return float(m.group())
    return None


async def capturar_y_enviar():
    with mss.mss() as sct:
        monitor = sct.monitors[CONFIG["monitor"]]

        # OCR en paralelo para todas las zonas
        imgs = {
            k: capturar_zona(sct, monitor, CONFIG[k])
            for k in ("zona_modelo_a", "zona_ok_a", "zona_ng_a", "zona_pass_a",
                      "zona_ok_b", "zona_ng_b", "zona_pass_b")
        }

        textos = {}
        for k, img in imgs.items():
            # Agrandar imagen para mejor OCR (x2)
            img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
            textos[k] = await ocr_zona(img)

    log.debug(f"OCR raw: {textos}")

    modelo    = textos["zona_modelo_a"][:60] if textos["zona_modelo_a"] else None
    ok_a      = limpiar_numero(textos["zona_ok_a"])
    ng_a      = limpiar_numero(textos["zona_ng_a"])
    pass_a    = limpiar_numero(textos["zona_pass_a"])
    ok_b      = limpiar_numero(textos["zona_ok_b"])
    ng_b      = limpiar_numero(textos["zona_ng_b"])
    pass_b    = limpiar_numero(textos["zona_pass_b"])

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
        resp = requests.post(
            CONFIG["backend_url"],
            json=payload,
            timeout=15,
        )
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
        img  = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")

    draw   = ImageDraw.Draw(img)
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
    log.info("Guardado 'calibracion.png' — abre el archivo y verifica que las zonas estén en los valores correctos.")
    log.info("Ajusta las coordenadas en CONFIG si es necesario y vuelve a compilar.")


def main():
    if "--calibrar" in sys.argv:
        calibrar()
        return

    log.info(f"FCT Agent iniciado — estacion={CONFIG['estacion_id']} intervalo={CONFIG['intervalo']}s")
    log.info(f"Backend: {CONFIG['backend_url']}")
    log.info("Tip: ejecuta con --calibrar para verificar las zonas de captura")

    while True:
        asyncio.run(capturar_y_enviar())
        time.sleep(CONFIG["intervalo"])


if __name__ == "__main__":
    main()
