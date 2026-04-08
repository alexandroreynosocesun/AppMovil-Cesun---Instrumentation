"""
UPH FASE 2 - OCR Cliente v2
Zonas actualizadas segun pantalla MES real.
HIKEYMACL en barra inferior, contador junto al input verde.
"""

import time
import re
import requests
import numpy as np
import cv2
import mss
import pytesseract
from collections import Counter
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

SERVIDOR_URL = "http://172.29.67.188:8000/api/uph"

# Zona barra inferior MES — donde aparece HIKEYMACL603(GOOD)
ZONA_HIKEYMACL = {
    "top":    835,
    "left":   0,
    "width":  1600,
    "height": 45,
}

# Zona contador numerico — junto al input verde (derecha)
ZONA_CONTADOR = {
    "top": 743,
    "left": 669,
    "width": 75,
    "height": 32,
}

# Zona "Pallet Num Create Sucess" — texto azul en el log
ZONA_PALLET_SUCCESS = {
    "top":    520,
    "left":   130,
    "width":  700,
    "height": 40,
}

INTERVALO_SEGUNDOS = 0.3
PATRON = r"HIKEYMA[CG]L(\d{3})"   # acepta cualquier estacion, no solo 6xx
LINEA = "L6"

# ─────────────────────────────────────────────


def enviar_servidor(estacion, contador_val):
    try:
        requests.post(
            f"{SERVIDOR_URL}/evento",
            json={
                "linea": LINEA,
                "estacion": estacion,
                "evento": "GOOD",
                "contador": contador_val,
                "timestamp": datetime.now().isoformat()
            },
            timeout=2
        )
    except Exception:
        pass


def capturar_roi(sct, zona):
    img = sct.grab(zona)
    arr = np.array(img)
    return cv2.cvtColor(arr, cv2.COLOR_BGRA2GRAY)


def preprocesar_contador(img_gris):
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    _, binaria = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = np.ones((2, 2), np.uint8)
    return cv2.dilate(binaria, kernel, iterations=1)


def preprocesar_texto(img_gris):
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    _, binaria = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binaria


def leer_contador(img_gris):
    img = preprocesar_contador(img_gris)
    config = "--psm 8 --oem 3 -c tessedit_char_whitelist=0123456789"
    texto = pytesseract.image_to_string(img, config=config).strip()
    return texto if texto.isdigit() else None


def detectar_pallet_success(img_gris):
    img = preprocesar_texto(img_gris)
    config = "--psm 6 --oem 3"
    texto = pytesseract.image_to_string(img, config=config).strip().upper()
    return "PALLET" in texto and "CREATE" in texto and ("SUCESS" in texto or "SUCCESS" in texto)


def leer_hikeymacl(img_gris):
    img = preprocesar_texto(img_gris)
    config = "--psm 6 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789() "
    texto = pytesseract.image_to_string(img, config=config).strip().upper()
    matches = re.findall(PATRON, texto)
    return matches[0] if matches else None


def confirmar_contador(sct, intentos=3, pausa=0.1):
    lecturas = []
    for _ in range(intentos):
        img = capturar_roi(sct, ZONA_CONTADOR)
        val = leer_contador(img)
        lecturas.append(val)
        time.sleep(pausa)
    validos = [v for v in lecturas if v is not None]
    if not validos:
        return None
    mas_comun, cuenta = Counter(validos).most_common(1)[0]
    return mas_comun if cuenta >= 2 else None


def main():
    print("=" * 55)
    print("  UPH FASE 2 v2 - LINEA 6 | Screenshot + OCR")
    print("=" * 55)
    print(f"  Servidor: {SERVIDOR_URL}")
    print("=" * 55)
    print("\n[INICIO] Monitoreando. Ctrl+C para detener.\n")

    contador_anterior = None
    success_disparado = False

    with mss.mss() as sct:
        while True:
            try:
                # EVENTO 30: Pallet Num Create Sucess
                if contador_anterior == "29" and not success_disparado:
                    img_ps = capturar_roi(sct, ZONA_PALLET_SUCCESS)
                    if detectar_pallet_success(img_ps):
                        img_hik = capturar_roi(sct, ZONA_HIKEYMACL)
                        estacion = leer_hikeymacl(img_hik)
                        ts = datetime.now().strftime("%H:%M:%S")
                        if estacion:
                            print(f"[{ts}] PALLET COMPLETO → HIKEYMACL{estacion} | cnt=30")
                            enviar_servidor(estacion, 30)
                        else:
                            print(f"[{ts}] PALLET COMPLETO (sin estacion OCR) | cnt=30")
                            tag = ts.replace(":", "")
                            cv2.imwrite(f"debug_hik_pallet_{tag}.png", img_hik)
                        success_disparado = True

                # LECTURA NORMAL DEL CONTADOR
                img_cnt = capturar_roi(sct, ZONA_CONTADOR)
                contador_actual = leer_contador(img_cnt)

                if contador_actual is None:
                    time.sleep(INTERVALO_SEGUNDOS)
                    continue

                if contador_actual == contador_anterior:
                    time.sleep(INTERVALO_SEGUNDOS)
                    continue

                if contador_actual == "1":
                    success_disparado = False

                time.sleep(0.15)

                img_hik = capturar_roi(sct, ZONA_HIKEYMACL)

                contador_confirmado = confirmar_contador(sct)
                if contador_confirmado is None or contador_confirmado != contador_actual:
                    time.sleep(INTERVALO_SEGUNDOS)
                    continue

                estacion = leer_hikeymacl(img_hik)

                ts = datetime.now().strftime("%H:%M:%S")
                if estacion:
                    print(f"[{ts}] OK   HIKEYMACL{estacion} | cnt={contador_actual}")
                    enviar_servidor(estacion, contador_actual)
                else:
                    print(f"[{ts}] SIN MATCH | cnt={contador_actual}")
                    tag = ts.replace(":", "")
                    cv2.imwrite(f"debug_hik_{tag}.png", img_hik)
                    cv2.imwrite(f"debug_cnt_{tag}.png", img_cnt)

                contador_anterior = contador_actual
                time.sleep(INTERVALO_SEGUNDOS)

            except KeyboardInterrupt:
                print("\n[FIN] Monitoreo detenido.")
                break
            except Exception as e:
                print(f"[ERROR] {e}")
                time.sleep(INTERVALO_SEGUNDOS)


if __name__ == "__main__":
    main()
