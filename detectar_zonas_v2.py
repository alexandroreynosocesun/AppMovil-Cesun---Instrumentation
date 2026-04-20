"""
DETECTOR DE ZONAS v2 - UPH
Escanea la pantalla y encuentra donde estan:
  - HIKEYMACL (barra inferior MES)
  - Contador numerico (junto al input verde)
  - Pallet Num Create Sucess (texto azul)

Corre este script con el MES visible en pantalla.
Guarda pantalla_completa.png y muestra las coordenadas encontradas.
"""

import pytesseract
import cv2
import numpy as np
import mss
import re
import time

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

PATRON_HIKEY = r"HIKEYMA[CG]L\(?(\d{3})\)?"


def capturar_pantalla(sct):
    monitor = sct.monitors[1]
    img = sct.grab(monitor)
    arr = np.array(img)
    return cv2.cvtColor(arr, cv2.COLOR_BGRA2GRAY), monitor["width"], monitor["height"]


def preprocesar(img_gris, escala=2):
    h, w = img_gris.shape
    img = cv2.resize(img_gris, (w * escala, h * escala), interpolation=cv2.INTER_CUBIC)
    _, binaria = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binaria


def escanear(img, ancho, alto, paso=20, altura_franja=40):
    encontrados = []

    print(f"\nResolucion detectada: {ancho}x{alto}")
    print(f"Escaneando en franjas de {altura_franja}px cada {paso}px...\n")

    for y in range(0, alto - altura_franja, paso):
        franja = img[y:y + altura_franja, :]
        bin_img = preprocesar(franja, escala=2)
        texto = pytesseract.image_to_string(bin_img, config="--psm 6 --oem 3").strip().upper()

        if not texto:
            continue

        # HIKEYMACL
        match = re.search(PATRON_HIKEY, texto)
        if match:
            print(f"  *** HIKEYMACL encontrado ***")
            print(f"      top={y}  height={altura_franja}")
            print(f"      Estacion: {match.group(1)}")
            print(f"      Texto: {texto[:100]}\n")
            encontrados.append(("HIKEYMACL", y, altura_franja, match.group(1)))

        # PALLET SUCCESS
        if "PALLET" in texto and "CREATE" in texto and ("SUCESS" in texto or "SUCCESS" in texto):
            print(f"  *** PALLET SUCCESS encontrado ***")
            print(f"      top={y}  height={altura_franja}")
            print(f"      Texto: {texto[:100]}\n")
            encontrados.append(("PALLET_SUCCESS", y, altura_franja, ""))

        # CONTADOR (numero solo entre 1 y 30)
        for linea in texto.split("\n"):
            linea = linea.strip()
            if linea.isdigit() and 1 <= int(linea) <= 30:
                print(f"  *** CONTADOR encontrado ***")
                print(f"      top={y}  height={altura_franja}")
                print(f"      Valor: {linea}\n")
                encontrados.append(("CONTADOR", y, altura_franja, linea))
                break

    return encontrados


def guardar_debug(img, encontrados):
    img_color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    colores = {
        "HIKEYMACL":     (0, 255, 0),
        "PALLET_SUCCESS":(255, 0, 0),
        "CONTADOR":      (0, 0, 255),
    }
    for tipo, y, h, val in encontrados:
        color = colores.get(tipo, (255, 255, 0))
        cv2.rectangle(img_color, (0, y), (img.shape[1], y + h), color, 2)
        cv2.putText(img_color, f"{tipo} {val}", (5, y + 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    cv2.imwrite("pantalla_zonas.png", img_color)
    print("Imagen guardada: pantalla_zonas.png")


def main():
    print("=" * 60)
    print("  DETECTOR DE ZONAS v2 - UPH")
    print("=" * 60)
    print("\nAsegurate que el MES este visible.")
    print("Capturando en 3 segundos...\n")
    time.sleep(3)

    with mss.mss() as sct:
        img, ancho, alto = capturar_pantalla(sct)

    cv2.imwrite("pantalla_completa.png", img)
    print("Pantalla guardada: pantalla_completa.png\n")

    encontrados = escanear(img, ancho, alto)
    guardar_debug(img, encontrados)

    print("\n" + "=" * 60)
    print("RESUMEN — copia estas zonas a fase2_ocr_cliente_v2.py:")
    print("=" * 60)

    for tipo, y, h, val in encontrados:
        if tipo == "HIKEYMACL":
            print(f"\nZONA_HIKEYMACL = {{")
            print(f'    "top":    {y},')
            print(f'    "left":   0,')
            print(f'    "width":  {ancho},')
            print(f'    "height": {h},')
            print(f"}}")
        elif tipo == "PALLET_SUCCESS":
            print(f"\nZONA_PALLET_SUCCESS = {{")
            print(f'    "top":    {y},')
            print(f'    "left":   0,')
            print(f'    "width":  {ancho},')
            print(f'    "height": {h},')
            print(f"}}")
        elif tipo == "CONTADOR":
            print(f"\nZONA_CONTADOR = {{")
            print(f'    "top":    {y},')
            print(f'    "left":   0,   # ajustar left/width manualmente')
            print(f'    "width":  100,')
            print(f'    "height": {h},')
            print(f"}}")

    if not encontrados:
        print("No se encontro nada. Revisa pantalla_completa.png")
        print("El MES debe estar visible y sin ventanas encima.")

    print("\n" + "=" * 60)
    input("Presiona Enter para salir...")


if __name__ == "__main__":
    main()
