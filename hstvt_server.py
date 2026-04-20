import os
import sys
import json
from urllib.parse import parse_qs
from waitress import serve

# Ruta configurable: argumento de línea de comandos o variable de entorno
# Ejemplo: python hstvt_server.py "\\172.29.172.155\Scripts"
if len(sys.argv) > 1:
    SCRIPTS_DIR = sys.argv[1]
else:
    SCRIPTS_DIR = os.environ.get("SCRIPTS_DIR", r"Z:\Semi-automatic testing\1.Test Scripts")

print(f"SCRIPTS_DIR: {SCRIPTS_DIR}")
print(f"Existe: {os.path.exists(SCRIPTS_DIR)}")


def json_response(start_response, data, status="200 OK"):
    body = json.dumps(data).encode("utf-8")
    headers = [("Content-Type", "application/json"), ("Content-Length", str(len(body)))]
    start_response(status, headers)
    return [body]


def _scan_scripts():
    """Escanea SCRIPTS_DIR y subcarpeta 'old' buscando .HStVt"""
    files = []
    dirs_a_escanear = [SCRIPTS_DIR, os.path.join(SCRIPTS_DIR, "old")]
    for directorio in dirs_a_escanear:
        if not os.path.exists(directorio):
            continue
        for f in os.listdir(directorio):
            if f.lower().endswith(".hstvt"):
                full = os.path.join(directorio, f)
                mtime = int(os.path.getmtime(full))
                files.append({"nombre": f, "fecha": mtime})
    return files


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")
    qs = parse_qs(environ.get("QUERY_STRING", ""))

    if path == "/scripts":
        if not os.path.exists(SCRIPTS_DIR):
            return json_response(start_response, {"error": f"Carpeta no encontrada: {SCRIPTS_DIR}", "scripts": [], "total": 0})
        files = _scan_scripts()
        return json_response(start_response, {"scripts": files, "total": len(files)})

    elif path == "/scripts/check":
        modelo = qs.get("modelo", [""])[0]
        if not os.path.exists(SCRIPTS_DIR):
            return json_response(start_response, {"existe": False, "archivos": []})
        files = _scan_scripts()
        matches = [f["nombre"] for f in files if modelo.upper() in f["nombre"].upper()]
        return json_response(start_response, {"modelo": modelo, "existe": len(matches) > 0, "archivos": matches})

    elif path == "/health":
        return json_response(start_response, {"status": "ok", "scripts_dir": SCRIPTS_DIR, "accesible": os.path.exists(SCRIPTS_DIR)})

    else:
        return json_response(start_response, {"error": "Not found"}, "404 Not Found")


if __name__ == "__main__":
    print("HSTVT server corriendo en http://0.0.0.0:5001")
    serve(application, host="0.0.0.0", port=5001, threads=32)
