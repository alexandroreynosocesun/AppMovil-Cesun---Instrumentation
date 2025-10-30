#!/usr/bin/env python3
"""
Script para actualizar automáticamente la URL de ngrok en la aplicación móvil
"""
import requests
import json
import os
import glob

def get_ngrok_url():
    """Obtiene la URL actual de ngrok"""
    try:
        response = requests.get('http://localhost:4040/api/tunnels')
        data = response.json()
        
        for tunnel in data['tunnels']:
            if tunnel['proto'] == 'https':
                return tunnel['public_url']
        
        return None
    except Exception as e:
        print(f"Error obteniendo URL de ngrok: {e}")
        return None

def update_service_files(new_url):
    """Actualiza todos los archivos de servicios con la nueva URL"""
    service_files = [
        'mobile/src/services/ValidationService.js',
        'mobile/src/services/AuthService.js',
        'mobile/src/services/JigNGService.js',
        'mobile/src/services/AdminService.js',
        'mobile/src/services/ReportService.js',
        'mobile/src/services/JigService.js'
    ]
    
    updated_files = []
    
    for file_path in service_files:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Buscar la línea con API_BASE_URL
                lines = content.split('\n')
                updated = False
                
                for i, line in enumerate(lines):
                    if 'const API_BASE_URL' in line and 'ngrok-free.app' in line:
                        # Extraer la URL actual
                        start = line.find("'") + 1
                        end = line.find("'", start)
                        old_url = line[start:end]
                        
                        # Construir nueva URL
                        new_api_url = f"{new_url}/api"
                        
                        # Reemplazar
                        lines[i] = line.replace(old_url, new_api_url)
                        updated = True
                        break
                
                if updated:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write('\n'.join(lines))
                    updated_files.append(file_path)
                    print(f"✅ Actualizado: {file_path}")
                else:
                    print(f"⚠️  No se encontró URL de ngrok en: {file_path}")
                    
            except Exception as e:
                print(f"❌ Error actualizando {file_path}: {e}")
        else:
            print(f"⚠️  Archivo no encontrado: {file_path}")
    
    return updated_files

def main():
    print("🔄 Obteniendo URL actual de ngrok...")
    
    ngrok_url = get_ngrok_url()
    
    if not ngrok_url:
        print("❌ No se pudo obtener la URL de ngrok. Asegúrate de que ngrok esté ejecutándose.")
        return
    
    print(f"📍 URL de ngrok encontrada: {ngrok_url}")
    
    print("🔄 Actualizando archivos de servicios...")
    updated_files = update_service_files(ngrok_url)
    
    if updated_files:
        print(f"\n✅ Se actualizaron {len(updated_files)} archivos:")
        for file in updated_files:
            print(f"   - {file}")
        print(f"\n🎉 ¡Listo! La aplicación móvil ahora usa: {ngrok_url}/api")
    else:
        print("❌ No se pudieron actualizar los archivos.")

if __name__ == "__main__":
    main()
