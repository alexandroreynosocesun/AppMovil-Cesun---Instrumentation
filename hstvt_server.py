import os
import json
from urllib.parse import parse_qs, urlparse
from waitress import serve

SCRIPTS_DIR = r"Z:\Semi-automatic testing\1.Test Scripts"


def json_response(start_response, data, status="200 OK"):
    body = json.dumps(data).encode("utf-8")
    headers = [("Content-Type", "application/json"), ("Content-Length", str(len(body)))]
    start_response(status, headers)
    return [body]


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")
    qs = parse_qs(environ.get("QUERY_STRING", ""))

    if path == "/scripts":
        if not os.path.exists(SCRIPTS_DIR):
            return json_response(start_response, {"error": "Carpeta no encontrada", "scripts": [], "total": 0})
        files = [f for f in os.listdir(SCRIPTS_DIR) if f.lower().endswith(".hstvt")]
        return json_response(start_response, {"scripts": files, "total": len(files)})

    elif path == "/scripts/check":
        modelo = qs.get("modelo", [""])[0]
        if not os.path.exists(SCRIPTS_DIR):
            return json_response(start_response, {"existe": False, "archivos": []})
        files = os.listdir(SCRIPTS_DIR)
        matches = [f for f in files if modelo.upper() in f.upper() and f.lower().endswith(".hstvt")]
        return json_response(start_response, {"modelo": modelo, "existe": len(matches) > 0, "archivos": matches})

    else:
        return json_response(start_response, {"error": "Not found"}, "404 Not Found")


if __name__ == "__main__":
    print("HSTVT server corriendo en http://0.0.0.0:5001")
    serve(application, host="0.0.0.0", port=5001, threads=32)
