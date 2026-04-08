"""
detect_zones.py — Detecta automáticamente las coordenadas de texto en la pantalla FCT.

Corre este script UNA VEZ con la pantalla FCT visible para obtener las coordenadas exactas.
Requiere: Tesseract instalado en C:\Program Files\Tesseract-OCR\tesseract.exe

USO:
  python detect_zones.py
  (o compilado: detect_zones.exe)

SALIDA:
  - deteccion.png  → imagen con todos los textos marcados + coordenadas
  - deteccion.txt  → lista de todos los textos detectados con (x, y, w, h)
"""

import sys
import mss
import numpy as np
import cv2
import pytesseract
from PIL import Image, ImageDraw

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

MONITOR = 1


def main():
    print("=" * 60)
    print("  DETECCIÓN DE ZONAS FCT")
    print("=" * 60)
    print("\nAsegúrate de que la pantalla FCT esté visible.")
    input("\nPresiona ENTER para capturar pantalla completa...\n")

    with mss.mss() as sct:
        monitor = sct.monitors[MONITOR]
        shot = sct.grab(monitor)
        ancho = monitor["width"]
        alto  = monitor["height"]

    print(f"Resolución detectada: {ancho}x{alto}")

    # Convertir a numpy BGR para OpenCV
    img_np = np.array(shot)
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_BGRA2BGR)
    cv2.imwrite("captura_completa.png", img_bgr)
    print("Captura guardada: captura_completa.png")

    # Preprocesar para OCR: escala de grises + threshold
    gris = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, binaria = cv2.threshold(gris, 150, 255, cv2.THRESH_BINARY)

    print("\nEjecutando OCR con detección de bounding boxes...")

    # Obtener datos de cada palabra con su posición
    config = "--psm 6"
    data = pytesseract.image_to_data(
        binaria,
        config=config,
        output_type=pytesseract.Output.DICT
    )

    # Imagen PIL para anotar
    img_pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(img_pil)

    colores = ["#FF4444", "#44FF44", "#4488FF", "#FFFF44", "#FF44FF", "#44FFFF",
               "#FF8844", "#88FF44", "#FF4488"]

    detecciones = []
    n = len(data["text"])
    color_idx = 0

    for i in range(n):
        texto = data["text"][i].strip()
        conf  = int(data["conf"][i])
        if not texto or conf < 30:
            continue

        x = data["left"][i]
        y = data["top"][i]
        w = data["width"][i]
        h = data["height"][i]

        color = colores[color_idx % len(colores)]
        color_idx += 1

        draw.rectangle([x, y, x + w, y + h], outline=color, width=2)
        label = f"{texto}({x},{y},{w},{h})"
        draw.rectangle([x, max(0, y - 14), x + len(label) * 6 + 4, y], fill="black")
        draw.text((x + 2, max(0, y - 13)), label, fill=color)

        es_numero = texto.replace(".", "").replace("%", "").isdigit()
        detecciones.append({
            "texto": texto,
            "x": x, "y": y, "w": w, "h": h,
            "conf": conf,
            "numero": es_numero,
        })

    img_pil.save("deteccion.png")
    print(f"\nGuardado 'deteccion.png' — {len(detecciones)} textos detectados")

    # Guardar lista
    with open("deteccion.txt", "w", encoding="utf-8") as f:
        f.write(f"Resolución: {ancho}x{alto}\n")
        f.write(f"Total textos detectados: {len(detecciones)}\n\n")
        f.write(f"{'TEXTO':<20} {'(x, y, w, h)':<28} {'CONF':>5}\n")
        f.write("-" * 60 + "\n")
        for d in detecciones:
            zona = f"({d['x']}, {d['y']}, {d['w']}, {d['h']})"
            f.write(f"{d['texto']:<20} {zona:<28} {d['conf']:>5}\n")

    print(f"\n{'TEXTO':<20} {'(x, y, w, h)':<28} {'CONF':>5}")
    print("-" * 60)
    for d in detecciones:
        zona = f"({d['x']}, {d['y']}, {d['w']}, {d['h']})"
        marca = " <-- NUMERO" if d["numero"] else ""
        print(f"{d['texto']:<20} {zona:<28} {d['conf']:>5}{marca}")

    print("\nGuardado 'deteccion.txt' con lista completa.")
    print("\nAbre 'deteccion.png' e identifica los rectangulos de OK, NG y Pass%.")
    print("Copia esas coordenadas (x, y, w, h) al CONFIG de fct_agent.py")

    input("\nPresiona ENTER para salir...")


if __name__ == "__main__":
    main()
