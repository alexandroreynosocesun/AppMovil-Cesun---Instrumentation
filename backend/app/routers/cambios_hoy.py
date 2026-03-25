"""
Cambios de Hoy — analiza imagen del MES con Claude Vision y extrae
las columnas del plan de producción.
"""
import base64
from fastapi import APIRouter, HTTPException, Depends
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
    imagen_base64: str  # data:image/jpeg;base64,... o solo el base64


@router.post("/analizar")
def analizar_imagen(
    body: ImagenRequest,
    current_user: Tecnico = Depends(get_current_user)
):
    roles_permitidos = {"tecnico", "ingeniero", "lider_linea", "admin", "superadmin", "asignaciones"}
    if current_user.tipo_usuario not in roles_permitidos:
        raise HTTPException(status_code=403, detail="Sin permiso")

    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="API Key de Anthropic no configurada. Contacta al administrador."
        )

    # Limpiar el prefijo data:image/...;base64, si viene
    b64 = body.imagen_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]

    # Detectar media type
    raw = body.imagen_base64
    if "image/png" in raw:
        media_type = "image/png"
    elif "image/webp" in raw:
        media_type = "image/webp"
    elif "image/gif" in raw:
        media_type = "image/gif"
    else:
        media_type = "image/jpeg"

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
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

        import json
        texto = message.content[0].text.strip()
        # Quitar bloques ```json ... ``` si Claude los agrega
        if texto.startswith("```"):
            texto = texto.split("```")[1]
            if texto.startswith("json"):
                texto = texto[4:]
        texto = texto.strip()

        datos = json.loads(texto)
        return {"ok": True, "data": datos}

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Claude no devolvio JSON valido: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
