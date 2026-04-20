"""
UPH FASE 2 - OCR Cliente
========================
Lee config_ocr.json (generado por configurador_zonas.py),
adapta coordenadas al monitor actual y envía eventos al servidor.

Uso:
  fase2_ocr_cliente.exe
  fase2_ocr_cliente.exe --config mi_config.json
  fase2_ocr_cliente.exe --debug   (guarda imágenes de cada lectura)
"""

import time
import re
import json
import sys
import os
import argparse
from collections import Counter
from datetime import datetime

import requests
import numpy as np
import cv2
import mss
import pytesseract

# ─────────────────────────────────────────────────────────────────
# TESSERACT - busca automáticamente si no está en PATH
# ─────────────────────────────────────────────────────────────────
def _find_tesseract():
    # 1. Junto al propio exe (portátil)
    _exe_dir = os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))
    _paths = [
        os.path.join(_exe_dir, "tesseract.exe"),
        os.path.join(_exe_dir, "Tesseract-OCR", "tesseract.exe"),
    ]

    # 2. Rutas de instalación comunes
    _paths += [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\Tesseract-OCR\tesseract.exe",
        r"C:\Users\hmx.ami\AppData\Local\Tesseract-OCR\tesseract.exe",
        r"C:\Users\Public\Tesseract-OCR\tesseract.exe",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Tesseract-OCR", "tesseract.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Tesseract-OCR", "tesseract.exe"),
    ]

    for _p in _paths:
        if _p and os.path.exists(_p):
            return _p

    # 3. Registro de Windows
    try:
        import winreg
        for _hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            try:
                key = winreg.OpenKey(_hive, r"SOFTWARE\Tesseract-OCR")
                path_val, _ = winreg.QueryValueEx(key, "InstallDir")
                candidate = os.path.join(path_val, "tesseract.exe")
                if os.path.exists(candidate):
                    return candidate
            except Exception:
                pass
    except ImportError:
        pass

    # 4. Buscar con 'where' (PATH del sistema)
    try:
        import subprocess
        result = subprocess.run(["where", "tesseract"], capture_output=True, text=True, timeout=3)
        if result.returncode == 0:
            found = result.stdout.strip().splitlines()[0]
            if os.path.exists(found):
                return found
    except Exception:
        pass

    return None

_tess = _find_tesseract()
if _tess:
    pytesseract.pytesseract.tesseract_cmd = _tess

CONFIG_DEFAULT = "config_ocr.json"

# ─────────────────────────────────────────────────────────────────
# CARGA DE CONFIGURACIÓN
# ─────────────────────────────────────────────────────────────────

def cargar_config(path):
    if not os.path.exists(path):
        print(f"[ERROR] No se encontró config: {path}")
        print("  Ejecuta primero: configurador_zonas.exe")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def resolver_zona(zona_rel, sw, sh):
    """Convierte zona relativa (%) a píxeles del monitor actual."""
    return {
        "top":    int(zona_rel["top_pct"]    * sh),
        "left":   int(zona_rel["left_pct"]   * sw),
        "width":  int(zona_rel["width_pct"]  * sw),
        "height": int(zona_rel["height_pct"] * sh),
    }


# ─────────────────────────────────────────────────────────────────
# PROCESAMIENTO DE IMAGEN
# ─────────────────────────────────────────────────────────────────

def capturar_roi(sct, zona):
    img = sct.grab(zona)
    arr = np.array(img)
    return cv2.cvtColor(arr, cv2.COLOR_BGRA2GRAY)


def preprocesar_contador(img_gris):
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    _, bin_ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = np.ones((2, 2), np.uint8)
    return cv2.dilate(bin_, kernel, iterations=1)


def preprocesar_texto(img_gris):
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    _, bin_ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bin_


def leer_contador(img_gris):
    img = preprocesar_contador(img_gris)
    cfg = "--psm 8 --oem 3 -c tessedit_char_whitelist=0123456789"
    texto = pytesseract.image_to_string(img, config=cfg).strip()
    return texto if texto.isdigit() else None


def leer_estacion(img_gris, patron):
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    _, bin_ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    inv = cv2.bitwise_not(bin_)
    cfg = "--psm 8 --oem 3 -c tessedit_char_whitelist=0123456789"
    for candidato in [bin_, inv]:
        texto = pytesseract.image_to_string(candidato, config=cfg).strip()
        matches = re.findall(patron, texto)
        if matches:
            return matches[0]
    return None


def confirmar_contador(sct, zona, intentos=3, pausa=0.08):
    lecturas = []
    for _ in range(intentos):
        img = capturar_roi(sct, zona)
        val = leer_contador(img)
        lecturas.append(val)
        time.sleep(pausa)
    validos = [v for v in lecturas if v is not None]
    if not validos:
        return None
    mas_comun, cuenta = Counter(validos).most_common(1)[0]
    # "1" (reset de pallet) aceptar con 1 sola lectura
    if mas_comun == "1":
        return mas_comun
    return mas_comun if cuenta >= 2 else None


# ─────────────────────────────────────────────────────────────────
# ENVÍO AL SERVIDOR
# ─────────────────────────────────────────────────────────────────

def enviar_servidor(url, linea, estacion, contador_val):
    try:
        requests.post(
            f"{url}/evento",
            json={
                "linea":     linea,
                "estacion":  estacion,
                "evento":    "GOOD",
                "contador":  contador_val,
                "timestamp": datetime.now().isoformat(),
            },
            timeout=2,
        )
    except Exception:
        pass




# ─────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="UPH OCR Cliente")
    parser.add_argument("--config", default=CONFIG_DEFAULT)
    parser.add_argument("--debug",  action="store_true", help="Guarda imágenes de debug")
    args = parser.parse_args()

    cfg = cargar_config(args.config)

    servidor_url = cfg["servidor_url"]
    linea        = cfg["linea"]
    patron       = cfg["patron"]
    intervalo    = cfg.get("intervalo_segundos", 0.3)
    debug        = args.debug

    print("=" * 60)
    print("  UPH OCR CLIENTE")
    print("=" * 60)
    print(f"  Config:   {args.config}")
    print(f"  Servidor: {servidor_url}")
    print(f"  Línea:    {linea}")
    print(f"  Patrón:   {patron} (estacion)")
    print(f"  Intervalo:{intervalo}s")
    print("=" * 60)

    with mss.mss() as sct:
        mon = sct.monitors[1]
        sw, sh = mon["width"], mon["height"]

        # Resolver zonas al monitor actual
        zonas_rel = cfg["zonas"]
        zonas = {k: resolver_zona(v, sw, sh) for k, v in zonas_rel.items()}

        print(f"\n  Monitor: {sw}×{sh}")
        for k, z in zonas.items():
            print(f"  {k:20s}: top={z['top']} left={z['left']} {z['width']}×{z['height']}")
        print("\n[INICIO] Monitoreando. Ctrl+C para detener.\n")

        contador_anterior = None
        ultima_estacion   = None

        while True:
            try:
                # ── Lectura del contador ──────────────────────────────────
                img_cnt = capturar_roi(sct, zonas["contador"])
                contador_actual = leer_contador(img_cnt)

                if contador_actual is None:
                    time.sleep(intervalo)
                    continue

                if contador_actual == contador_anterior:
                    time.sleep(intervalo)
                    continue

                # ── Auto-completar pallet: 29 → 1 (reset sin mostrar 30) ─
                if contador_actual == "1" and contador_anterior == "29":
                    ts = datetime.now().strftime("%H:%M:%S")
                    est = ultima_estacion
                    if est:
                        print(f"[{ts}] AUTO-30 → estacion={est} | cnt=30")
                        enviar_servidor(servidor_url, linea, est, 30)
                    else:
                        print(f"[{ts}] AUTO-30 (sin estacion) | cnt=30")

                # Esperar render para estabilidad
                time.sleep(0.12)

                # Capturar estación (frame fresco)
                img_est = capturar_roi(sct, zonas["estacion"])

                # OCR estación
                estacion = leer_estacion(img_est, patron)
                ts = datetime.now().strftime("%H:%M:%S")

                if estacion:
                    print(f"[{ts}] OK   est={estacion} | cnt={contador_actual}")
                    enviar_servidor(servidor_url, linea, estacion, int(contador_actual))
                    ultima_estacion = estacion
                else:
                    print(f"[{ts}] SIN MATCH | cnt={contador_actual}")
                    if debug:
                        tag = ts.replace(":", "")
                        cv2.imwrite(f"debug_est_{tag}.png", img_est)
                        cv2.imwrite(f"debug_cnt_{tag}.png", img_cnt)

                contador_anterior = contador_actual
                time.sleep(intervalo)

            except KeyboardInterrupt:
                print("\n[FIN] Monitoreo detenido.")
                break
            except Exception as e:
                print(f"[ERROR] {e}")
                time.sleep(intervalo)


if __name__ == "__main__":
    main()
