"""
Configurador de Zonas - UPH OCR
================================
Toma screenshot de la pantalla actual, permite seleccionar 3 zonas
con el mouse y guarda config.json con coordenadas relativas (%).

Uso:
  python configurador_zonas.py
  python configurador_zonas.py --config mi_config.json

Controles:
  - Click y arrastra para dibujar zona
  - Presiona 1/2/3 para elegir qué zona configurar
  - Presiona ENTER para guardar y salir
  - Presiona R para retomar screenshot
  - Presiona ESC para salir sin guardar
"""

import json
import sys
import os
import argparse
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import mss
import numpy as np
import cv2
from PIL import Image, ImageTk

CONFIG_DEFAULT = "config_ocr.json"

ZONAS_DEF = [
    {"key": "contador", "label": "1 - CONTADOR (número en pantalla)",   "color": "#00FF00"},
    {"key": "estacion", "label": "2 - ESTACION (número: 101, 202...)", "color": "#FF4444"},
]


def tomar_screenshot():
    with mss.mss() as sct:
        mon = sct.monitors[1]  # monitor principal
        img = sct.grab(mon)
        arr = np.array(img)
        rgb = cv2.cvtColor(arr, cv2.COLOR_BGRA2RGB)
        return rgb, mon["width"], mon["height"]


def rel_to_abs(zona_rel, sw, sh):
    return {
        "top":    int(zona_rel["top_pct"]    * sh),
        "left":   int(zona_rel["left_pct"]   * sw),
        "width":  int(zona_rel["width_pct"]  * sw),
        "height": int(zona_rel["height_pct"] * sh),
    }


def abs_to_rel(zona_abs, sw, sh):
    return {
        "top_pct":    zona_abs["top"]    / sh,
        "left_pct":   zona_abs["left"]   / sw,
        "width_pct":  zona_abs["width"]  / sw,
        "height_pct": zona_abs["height"] / sh,
    }


class ConfiguradorApp:
    def __init__(self, root, config_path):
        self.root = root
        self.config_path = config_path
        self.root.title("Configurador de Zonas OCR — UPH")
        self.root.configure(bg="#1a1a2e")

        self.zonas = {z["key"]: None for z in ZONAS_DEF}
        self.zona_activa = 0  # índice en ZONAS_DEF

        # Screenshot
        self.img_rgb, self.sw, self.sh = tomar_screenshot()
        self.img_display = None
        self.scale = 1.0

        # Canvas rect drawing state
        self.rect_start = None
        self.rect_id = None

        # Zoom
        self.zoom = 1.0
        self.zoom_offset_x = 0
        self.zoom_offset_y = 0

        # Servidor / config extra
        self.servidor_url = tk.StringVar(value="http://172.29.67.53:5000/api/uph")
        self.linea        = tk.StringVar(value="L6")
        self.patron       = tk.StringVar(value=r"(\d{3})")
        self.intervalo    = tk.StringVar(value="0.3")

        self._cargar_config_existente()
        self._build_ui()
        self._actualizar_canvas()

    def _cargar_config_existente(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, encoding="utf-8") as f:
                    cfg = json.load(f)
                self.servidor_url.set(cfg.get("servidor_url", self.servidor_url.get()))
                self.linea.set(cfg.get("linea", self.linea.get()))
                self.patron.set(cfg.get("patron", self.patron.get()))
                self.intervalo.set(str(cfg.get("intervalo_segundos", self.intervalo.get())))
                for z in ZONAS_DEF:
                    k = z["key"]
                    if k in cfg.get("zonas", {}):
                        self.zonas[k] = cfg["zonas"][k]
            except Exception:
                pass

    def _build_ui(self):
        # ── Panel izquierdo ──────────────────────────────────────────
        left = tk.Frame(self.root, bg="#1a1a2e", width=320)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=10)
        left.pack_propagate(False)

        tk.Label(left, text="CONFIGURADOR DE ZONAS", bg="#1a1a2e",
                 fg="#00d4ff", font=("Consolas", 13, "bold")).pack(pady=(0, 12))

        # ── Zona activa ──────────────────────────────────────────────
        tk.Label(left, text="ZONA A CONFIGURAR", bg="#1a1a2e",
                 fg="#546E7A", font=("Consolas", 9)).pack(anchor="w")
        self.zona_btns = []
        for i, z in enumerate(ZONAS_DEF):
            btn = tk.Button(
                left, text=z["label"], bg="#0d1b2a", fg=z["color"],
                font=("Consolas", 9), anchor="w", padx=8,
                relief="flat", cursor="hand2",
                command=lambda idx=i: self._set_zona_activa(idx)
            )
            btn.pack(fill=tk.X, pady=2)
            self.zona_btns.append(btn)

        # ── Estado de zonas ──────────────────────────────────────────
        tk.Label(left, text="\nESTADO DE ZONAS", bg="#1a1a2e",
                 fg="#546E7A", font=("Consolas", 9)).pack(anchor="w")
        self.estado_labels = {}
        for z in ZONAS_DEF:
            row = tk.Frame(left, bg="#1a1a2e")
            row.pack(fill=tk.X, pady=1)
            tk.Label(row, text=z["key"].upper(), bg="#1a1a2e",
                     fg="#37474F", font=("Consolas", 8), width=14, anchor="w").pack(side=tk.LEFT)
            lbl = tk.Label(row, text="⬜ Sin definir", bg="#1a1a2e",
                           fg="#37474F", font=("Consolas", 8), anchor="w")
            lbl.pack(side=tk.LEFT)
            self.estado_labels[z["key"]] = lbl

        # ── Config servidor ──────────────────────────────────────────
        tk.Label(left, text="\nCONFIGURACIÓN", bg="#1a1a2e",
                 fg="#546E7A", font=("Consolas", 9)).pack(anchor="w")

        for lbl_txt, var in [
            ("Servidor URL:", self.servidor_url),
            ("Línea:",        self.linea),
            ("Patrón REGEX:", self.patron),
            ("Intervalo (s):", self.intervalo),
        ]:
            tk.Label(left, text=lbl_txt, bg="#1a1a2e", fg="#90CAF9",
                     font=("Consolas", 8)).pack(anchor="w", pady=(6, 0))
            tk.Entry(left, textvariable=var, bg="#0d1b2a", fg="#fff",
                     font=("Consolas", 9), insertbackground="#fff",
                     relief="flat").pack(fill=tk.X, pady=2)

        # ── Botones ──────────────────────────────────────────────────
        tk.Label(left, text="", bg="#1a1a2e").pack(expand=True)

        btn_frame = tk.Frame(left, bg="#1a1a2e")
        btn_frame.pack(fill=tk.X, pady=4)

        tk.Button(btn_frame, text="📷 Nuevo screenshot", bg="#0d2137", fg="#90CAF9",
                  font=("Consolas", 9), relief="flat", cursor="hand2",
                  command=self._nuevo_screenshot).pack(fill=tk.X, pady=2)

        tk.Button(btn_frame, text="✅ Guardar config", bg="#003320", fg="#00FF88",
                  font=("Consolas", 10, "bold"), relief="flat", cursor="hand2",
                  command=self._guardar).pack(fill=tk.X, pady=4)

        tk.Button(btn_frame, text="❌ Salir sin guardar", bg="#1a0000", fg="#FF4444",
                  font=("Consolas", 9), relief="flat", cursor="hand2",
                  command=self.root.quit).pack(fill=tk.X, pady=2)

        self.status_lbl = tk.Label(left, text="Selecciona una zona y dibuja en el canvas",
                                   bg="#1a1a2e", fg="#546E7A",
                                   font=("Consolas", 8), wraplength=280, justify="left")
        self.status_lbl.pack(pady=6)

        # ── Canvas derecho ───────────────────────────────────────────
        canvas_frame = tk.Frame(self.root, bg="#000")
        canvas_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10), pady=10)

        self.canvas = tk.Canvas(canvas_frame, bg="#000", cursor="crosshair",
                                highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        self.canvas.bind("<ButtonPress-1>",   self._mouse_down)
        self.canvas.bind("<B1-Motion>",       self._mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self._mouse_up)
        self.canvas.bind("<Configure>",       self._on_resize)
        self.canvas.bind("<MouseWheel>",      self._on_scroll)
        self.canvas.bind("<ButtonPress-2>",   self._pan_start)
        self.canvas.bind("<B2-Motion>",       self._pan_move)
        self.canvas.bind("<ButtonPress-3>",   self._pan_start)
        self.canvas.bind("<B3-Motion>",       self._pan_move)

        self.root.bind("1", lambda e: self._set_zona_activa(0))
        self.root.bind("2", lambda e: self._set_zona_activa(1))
        self.root.bind("<Return>", lambda e: self._guardar())
        self.root.bind("r",        lambda e: self._nuevo_screenshot())
        self.root.bind("0",        lambda e: self._reset_zoom())

        self._set_zona_activa(0)

    def _set_zona_activa(self, idx):
        self.zona_activa = idx
        for i, btn in enumerate(self.zona_btns):
            color = ZONAS_DEF[i]["color"] if i == idx else "#37474F"
            bg    = "#0d2137" if i == idx else "#0d1b2a"
            btn.config(fg=color, bg=bg)
        z = ZONAS_DEF[idx]
        self.status_lbl.config(
            text=f"Dibuja la zona: {z['label']}\nClick y arrastra en el canvas"
        )

    def _effective_scale(self):
        return self.scale * self.zoom

    def _actualizar_canvas(self):
        self.root.update_idletasks()
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()

        if cw < 10 or ch < 10:
            self.root.after(100, self._actualizar_canvas)
            return

        ih, iw = self.img_rgb.shape[:2]
        scale_x = cw / iw
        scale_y = ch / ih
        self.scale = min(scale_x, scale_y)

        esc = self._effective_scale()
        nw = max(1, int(iw * esc))
        nh = max(1, int(ih * esc))

        # Centrar con offset de pan
        base_x = (cw - int(iw * self.scale)) // 2
        base_y = (ch - int(ih * self.scale)) // 2
        self.canvas_offset_x = base_x + self.zoom_offset_x
        self.canvas_offset_y = base_y + self.zoom_offset_y

        img_resized = cv2.resize(self.img_rgb, (nw, nh), interpolation=cv2.INTER_AREA)
        pil_img = Image.fromarray(img_resized)
        self.img_tk = ImageTk.PhotoImage(pil_img)

        self.canvas.delete("all")
        self.canvas.create_image(self.canvas_offset_x, self.canvas_offset_y,
                                 anchor="nw", image=self.img_tk)
        zoom_txt = f"Zoom: {self.zoom:.1f}x  (scroll=zoom, clic derecho=mover, 0=reset)"
        self.canvas.create_text(8, 8, text=zoom_txt, fill="#00d4ff",
                                anchor="nw", font=("Consolas", 8))
        self._dibujar_zonas()

    def _dibujar_zonas(self):
        esc = self._effective_scale()
        for z in ZONAS_DEF:
            k   = z["key"]
            rel = self.zonas[k]
            if rel is None:
                continue
            x1 = self.canvas_offset_x + rel["left_pct"]  * self.sw * esc
            y1 = self.canvas_offset_y + rel["top_pct"]   * self.sh * esc
            x2 = x1 + rel["width_pct"]  * self.sw * esc
            y2 = y1 + rel["height_pct"] * self.sh * esc
            self.canvas.create_rectangle(x1, y1, x2, y2, outline=z["color"], width=2)
            self.canvas.create_text(x1 + 4, y1 + 4, text=k.upper(),
                                    fill=z["color"], anchor="nw",
                                    font=("Consolas", 8, "bold"))
            abs_z = rel_to_abs(rel, self.sw, self.sh)
            self.estado_labels[k].config(
                text=f"✅ {abs_z['left']},{abs_z['top']} {abs_z['width']}×{abs_z['height']}",
                fg=z["color"]
            )

    def _canvas_to_screen(self, cx, cy):
        esc = self._effective_scale()
        sx = (cx - self.canvas_offset_x) / esc
        sy = (cy - self.canvas_offset_y) / esc
        return max(0, sx), max(0, sy)

    def _on_scroll(self, event):
        factor = 1.15 if event.delta > 0 else (1 / 1.15)
        self.zoom = max(1.0, min(10.0, self.zoom * factor))
        self._actualizar_canvas()

    def _reset_zoom(self):
        self.zoom = 1.0
        self.zoom_offset_x = 0
        self.zoom_offset_y = 0
        self._actualizar_canvas()

    def _pan_start(self, e):
        self._pan_last = (e.x, e.y)

    def _pan_move(self, e):
        dx = e.x - self._pan_last[0]
        dy = e.y - self._pan_last[1]
        self.zoom_offset_x += dx
        self.zoom_offset_y += dy
        self._pan_last = (e.x, e.y)
        self._actualizar_canvas()

    def _mouse_down(self, e):
        self.rect_start = (e.x, e.y)
        if self.rect_id:
            self.canvas.delete(self.rect_id)
            self.rect_id = None

    def _mouse_drag(self, e):
        if not self.rect_start:
            return
        if self.rect_id:
            self.canvas.delete(self.rect_id)
        color = ZONAS_DEF[self.zona_activa]["color"]
        self.rect_id = self.canvas.create_rectangle(
            self.rect_start[0], self.rect_start[1], e.x, e.y,
            outline=color, width=2, dash=(4, 4)
        )

    def _mouse_up(self, e):
        if not self.rect_start:
            return
        x1c, y1c = self.rect_start
        x2c, y2c = e.x, e.y
        # Normalizar
        if x1c > x2c: x1c, x2c = x2c, x1c
        if y1c > y2c: y1c, y2c = y2c, y1c
        # Mínimo 10px
        if (x2c - x1c) < 10 or (y2c - y1c) < 10:
            self.rect_start = None
            return

        sx1, sy1 = self._canvas_to_screen(x1c, y1c)
        sx2, sy2 = self._canvas_to_screen(x2c, y2c)

        z = ZONAS_DEF[self.zona_activa]
        self.zonas[z["key"]] = {
            "top_pct":    sy1 / self.sh,
            "left_pct":   sx1 / self.sw,
            "width_pct":  (sx2 - sx1) / self.sw,
            "height_pct": (sy2 - sy1) / self.sh,
        }
        self.rect_start = None
        # Avanzar a la siguiente zona automáticamente
        siguiente = (self.zona_activa + 1) % len(ZONAS_DEF)
        self._actualizar_canvas()
        self._set_zona_activa(siguiente)

    def _on_resize(self, event):
        self._actualizar_canvas()

    def _nuevo_screenshot(self):
        self.root.withdraw()
        self.root.update()
        import time; time.sleep(0.3)
        self.img_rgb, self.sw, self.sh = tomar_screenshot()
        self.root.deiconify()
        self._actualizar_canvas()

    def _guardar(self):
        sin_definir = [z["key"] for z in ZONAS_DEF if self.zonas[z["key"]] is None]
        if sin_definir:
            if not messagebox.askyesno(
                "Zonas incompletas",
                f"Las siguientes zonas no están definidas:\n{', '.join(sin_definir)}\n\n¿Guardar de todas formas?"
            ):
                return

        try:
            intervalo = float(self.intervalo.get())
        except ValueError:
            intervalo = 0.3

        config = {
            "servidor_url":        self.servidor_url.get().strip(),
            "linea":               self.linea.get().strip(),
            "patron":              self.patron.get().strip(),
            "intervalo_segundos":  intervalo,
            "monitor":             {"width": self.sw, "height": self.sh},
            "zonas":               {k: v for k, v in self.zonas.items() if v is not None},
        }

        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        messagebox.showinfo("Guardado", f"Config guardada en:\n{os.path.abspath(self.config_path)}")
        self.root.quit()


def main():
    parser = argparse.ArgumentParser(description="Configurador de zonas OCR")
    parser.add_argument("--config", default=CONFIG_DEFAULT, help="Ruta del archivo config JSON")
    args = parser.parse_args()

    root = tk.Tk()
    root.state("zoomed")
    app = ConfiguradorApp(root, args.config)
    root.mainloop()


if __name__ == "__main__":
    main()
