#!/usr/bin/env python3
"""
Script para ejecutar el servidor de desarrollo
"""
import uvicorn
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

if __name__ == "__main__":
    # Configuración del servidor
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    
    print("🚀 Iniciando servidor de Validación de Jigs...")
    print(f"📍 URL: http://{host}:{port}")
    print(f"📚 Documentación: http://{host}:{port}/docs")
    print("🛑 Presiona Ctrl+C para detener")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
