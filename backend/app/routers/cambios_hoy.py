"""
Cambios de Hoy — analiza imagen del MES con Claude Vision y extrae
las columnas del plan de producción.
"""
import base64
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from pydantic import BaseModel
from ..auth import get_current_user
from ..models.models import Tecnico
from ..config import ANTHROPIC_API_KEY

router = APIRouter(prefix="/api/cambios-hoy", tags=["cambios_hoy"])

COLUMNAS = (
    "Line, Rolling No, Internal Model, Market/Country, Board/Model, "
    "UPH, SW Version, Project ID, Keys, LCD Interface Type, Tool, Tool SW, Converter, MIC"
)

PROMPT = f"""Analiza esta imagen de una hoja de planificación de producción de televisores.
Extrae TODAS las filas visibles con sus datos en las siguientes columnas:
{COLUMNAS}

Reglas:
- Cada fila es una asignación de modelo a una línea de producción (HI-1, HI-2, etc.)
- Si una celda está vacía o dice #N/A, pon null
- El campo "status" puede ser: Done, Pending, Re-write, Write In, o null si no se ve
- Las filas con fondo amarillo/naranja son modelos nuevos o con cambios — marca "is_new": true
- Las filas con fondo rojo/rosa tienen problema — marca "has_issue": true
- Devuelve SOLO JSON válido, sin texto adicional, con esta estructura exacta:

{{
  "fecha": "la fecha que aparezca en la imagen o null",
  "lineas": [
    {{
      "linea": "HI-1",
      "rolling": "N25512V",
      "internal_model": "N25511B",
      "market_country": "Mexico",
      "model": "TPD.NT2690T.PB7",
      "uph": 250,
      "sw_version": "20766363B",
      "project_id": "P1231",
      "keys": 141,
      "lcd_interface": "MINI LVDS",
      "tool": "Mini26",
      "tool_sw": null,
      "converter": "ZH-mini-fhd_51",
      "mic": null,
      "status": "Done",
      "is_new": false,
      "has_issue": false
    }}
  ]
}}"""


class ImagenRequest(BaseModel):
    imagen_base64: str = ""  # data:image/jpeg;base64,... o solo el base64


@router.post("/debug-analizar")
async def debug_analizar(request: Request):
    """Endpoint debug — muestra que llega sin autenticacion."""
    try:
        raw = await request.body()
        import json as _json
        data = _json.loads(raw)
        key = data.get("imagen_base64", "CAMPO AUSENTE")
        return {
            "body_size": len(raw),
            "campo_presente": "imagen_base64" in data,
            "valor_inicio": key[:50] if isinstance(key, str) else str(key),
            "valor_tipo": type(key).__name__,
        }
    except Exception as e:
        return {"error": str(e), "body_size": 0}


@router.post("/analizar")
async def analizar_imagen(
    imagen: UploadFile = File(...),
    current_user: Tecnico = Depends(get_current_user)
):
    print(f"[CAMBIOS-HOY] usuario={current_user.usuario} | archivo={imagen.filename} | content_type={imagen.content_type}")
    roles_permitidos = {"tecnico", "ingeniero", "lider_linea", "admin", "superadmin", "asignaciones"}
    if current_user.tipo_usuario not in roles_permitidos:
        raise HTTPException(status_code=403, detail="Sin permiso")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="API Key de Anthropic no configurada. Contacta al administrador."
        )

    # Leer el archivo y convertir a base64
    import base64 as _b64
    contenido = await imagen.read()
    b64 = _b64.b64encode(contenido).decode("utf-8")

    # Detectar media type
    raw = imagen.content_type or "image/jpeg"
    if "png" in raw:
        media_type = "image/png"
    elif "webp" in raw:
        media_type = "image/webp"
    elif "gif" in raw:
        media_type = "image/gif"
    else:
        media_type = "image/jpeg"

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=16000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": PROMPT
                        }
                    ],
                }
            ],
        )

        import json, re
        texto = message.content[0].text.strip()
        print(f"[CAMBIOS-HOY] respuesta Claude (primeros 200 chars): {texto[:200]}")

        # Extraer JSON: buscar bloque ```json...``` o ```...``` o primer { ... }
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", texto)
        if m:
            texto = m.group(1).strip()
        else:
            inicio = texto.find("{")
            fin = texto.rfind("}")
            if inicio != -1 and fin != -1:
                texto = texto[inicio:fin + 1]

        # Eliminar caracteres de control que rompen el parser JSON
        # (excepto \n \r \t que son validos dentro de strings)
        texto = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', texto)

        datos = json.loads(texto)
        return {"ok": True, "data": datos}

    except json.JSONDecodeError as e:
        print(f"[CAMBIOS-HOY] JSONDecodeError: {e} | texto={texto[:300]}")
        raise HTTPException(status_code=500, detail=f"Claude no devolvio JSON valido: {e}")
    except Exception as e:
        print(f"[CAMBIOS-HOY] Exception: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
