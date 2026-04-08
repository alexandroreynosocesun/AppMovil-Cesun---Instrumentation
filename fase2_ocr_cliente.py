"""
UPH FASE 2 - OCR Cliente (Estable)
Screenshot -> ROI -> OCR -> Valida -> Envia solo si contador cambia.

Flujo:
  1. Screenshot de ZONA_CONTADOR cada segundo
  2. Confirma el valor leyendo 3 veces (mayoria) - evita lecturas en transicion
  3. Si el contador cambio, captura ZONA_HIKEYMACL y extrae estacion
  4. Guarda CSV + envia al servidor
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

# Zona donde aparece HIKEYMACL(GOOD)
ZONA_HIKEYMACL = {
    "top": 790,
    "left": 0,
    "width": 1600,
    "height": 40,
}

# Zona donde aparece el contador numerico del MES
ZONA_CONTADOR = {
    "top": 743,
    "left": 669,
    "width": 75,
    "height": 32,
}

# Zona donde aparece "Pallet Num Create Sucess" (texto azul en el log)
# ← Ajustar top/height si el texto aparece en otra posición de pantalla
ZONA_PALLET_SUCCESS = {
    "top":    683,
    "left":   425,  # +20px para excluir el "1" del serial antes de "Pallet"
    "width":  298,
    "height": 57,
}

INTERVALO_SEGUNDOS = 0.3
PATRON = r"HIKEYMA[CG]L(6\d\d)"
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
    """Screenshot de una zona y convierte directo a escala de grises."""
    img = sct.grab(zona)
    arr = np.array(img)
    return cv2.cvtColor(arr, cv2.COLOR_BGRA2GRAY)


def preprocesar_contador(img_gris):
    """4x + blur + OTSU + dilate — optimo para numeros pequeños."""
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    _, binaria = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = np.ones((2, 2), np.uint8)
    return cv2.dilate(binaria, kernel, iterations=1)


def preprocesar_texto(img_gris):
    """2x + OTSU — para texto largo como HIKEYMACL."""
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    _, binaria = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binaria


def leer_contador(img_gris):
    """Extrae numero del contador. Retorna string de digitos o None."""
    img = preprocesar_contador(img_gris)
    config = "--psm 8 --oem 3 -c tessedit_char_whitelist=0123456789"
    texto = pytesseract.image_to_string(img, config=config).strip()
    return texto if texto.isdigit() else None


def detectar_pallet_success(img_gris):
    """
    Detecta exactamente 'Pallet Num Create Sucess'.
    Requiere las 3 palabras clave: PALLET + CREATE + SUCESS/SUCCESS.
    Evita falsos positivos de otros textos que contengan solo una palabra.
    """
    img = preprocesar_texto(img_gris)
    config = "--psm 6 --oem 3"
    texto = pytesseract.image_to_string(img, config=config).strip().upper()
    tiene_pallet = "PALLET" in texto
    tiene_create = "CREATE" in texto
    tiene_sucess = "SUCESS" in texto or "SUCCESS" in texto
    return tiene_pallet and tiene_create and tiene_sucess


def leer_hikeymacl(img_gris):
    """Extrae numero de estacion HIKEYMACL. Retorna ej. '601' o None."""
    img = preprocesar_texto(img_gris)
    config = "--psm 7 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789() "
    texto = pytesseract.image_to_string(img, config=config).strip().upper()
    matches = re.findall(PATRON, texto)
    return matches[0] if matches else None


def confirmar_contador(sct, intentos=3, pausa=0.1):
    """
    Lee el contador N veces con pausa breve.
    Retorna el valor solo si al menos 2 lecturas coinciden (evita transiciones).
    """
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
    print("  UPH FASE 2 - LINEA 6 | Screenshot + OCR")
    print("=" * 55)
    print(f"  Servidor: {SERVIDOR_URL}")
    print("=" * 55)
    print("\n[INICIO] Monitoreando. Ctrl+C para detener.\n")

    contador_anterior = None
    # Evita disparar el evento 30 multiples veces si el texto persiste varios frames
    success_disparado = False

    with mss.mss() as sct:
        while True:
            try:
                # ── EVENTO 30: detectar "Pallet Num Create Sucess" ────────────
                # Solo válido si el último contador confirmado fue 29
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

                # ── LÓGICA NORMAL DEL CONTADOR ────────────────────────────────

                # 1. Lectura rapida del contador
                img_cnt = capturar_roi(sct, ZONA_CONTADOR)
                contador_actual = leer_contador(img_cnt)

                # 2. Si no se leyo nada, esperar
                if contador_actual is None:
                    time.sleep(INTERVALO_SEGUNDOS)
                    continue

                # 3. El contador no cambio, nada que hacer
                if contador_actual == contador_anterior:
                    time.sleep(INTERVALO_SEGUNDOS)
                    continue

                # Cuando arranca nuevo pallet (vuelve a 1), resetear flag
                if contador_actual == "1":
                    success_disparado = False

                # 4. Esperar render de pantalla antes de capturar
                time.sleep(0.15)

                # 5. Snapshot de HIKEYMACL
                img_hik = capturar_roi(sct, ZONA_HIKEYMACL)

                # 5. Confirmar que el contador es estable (no en transicion)
                contador_confirmado = confirmar_contador(sct)
                if contador_confirmado is None or contador_confirmado != contador_actual:
                    time.sleep(INTERVALO_SEGUNDOS)
                    continue

                # 6. OCR sobre el snapshot ya capturado
                estacion = leer_hikeymacl(img_hik)

                ts = datetime.now().strftime("%H:%M:%S")
                if estacion:
                    print(f"[{ts}] OK   HIKEYMACL{estacion} | cnt={contador_actual}")
                    enviar_servidor(estacion, contador_actual)
                else:
                    print(f"[{ts}] SIN MATCH | cnt={contador_actual}")
                    # Guarda imagenes para diagnosticar fallo de OCR
                    tag = ts.replace(":", "")
                    cv2.imwrite(f"debug_hik_{tag}.png", img_hik)
                    cv2.imwrite(f"debug_cnt_{tag}.png", img_cnt)

                # 7. Actualizar referencia (evita re-disparo)
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
