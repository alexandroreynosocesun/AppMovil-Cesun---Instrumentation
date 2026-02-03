#!/usr/bin/env python3
"""
Script para ejecutar el servidor de desarrollo/producción
"""
import uvicorn
import os
from dotenv import load_dotenv
from app.config import IS_PRODUCTION, SSL_KEYFILE, SSL_CERTFILE

# Cargar variables de entorno
load_dotenv()

if __name__ == "__main__":
    # Configuración del servidor
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "true").lower() == "true" and not IS_PRODUCTION
    
    # Configuración SSL para producción
    ssl_config = {}
    if IS_PRODUCTION and SSL_KEYFILE and SSL_CERTFILE:
        import os.path
        if os.path.exists(SSL_KEYFILE) and os.path.exists(SSL_CERTFILE):
            ssl_config = {
                "ssl_keyfile": SSL_KEYFILE,
                "ssl_certfile": SSL_CERTFILE
            }
            print("🔒 HTTPS habilitado con certificados SSL")
        else:
            print("⚠️ ADVERTENCIA: Archivos SSL no encontrados. Servidor ejecutándose sin HTTPS")
            if not os.path.exists(SSL_KEYFILE):
                print(f"   ❌ No se encontró: {SSL_KEYFILE}")
            if not os.path.exists(SSL_CERTFILE):
                print(f"   ❌ No se encontró: {SSL_CERTFILE}")
    elif IS_PRODUCTION:
        print("⚠️ ADVERTENCIA: Producción sin SSL configurado. Es altamente recomendado usar HTTPS")
        print("   Configura SSL_KEYFILE y SSL_CERTFILE en tu archivo .env")
    
    protocol = "https" if ssl_config else "http"
    print("🚀 Iniciando servidor de Hisense CheckApp...")
    print(f"📍 URL: {protocol}://{host}:{port}")
    print(f"📚 Documentación: {protocol}://{host}:{port}/docs")
    print(f"🔐 Modo: {'PRODUCCIÓN' if IS_PRODUCTION else 'DESARROLLO'}")
    if IS_PRODUCTION and not ssl_config:
        print("❌ ADVERTENCIA: Ejecutando en PRODUCCIÓN sin HTTPS. Esto es inseguro!")
    print("🛑 Presiona Ctrl+C para detener")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
        **ssl_config  # Aplicar configuración SSL si existe
    )
