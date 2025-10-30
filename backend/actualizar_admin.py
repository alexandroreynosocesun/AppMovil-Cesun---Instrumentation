#!/usr/bin/env python3
"""
Script para actualizar usuario admin con datos de Alexandro
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.models import Tecnico
from app.auth import get_password_hash

def actualizar_admin():
    """Actualizar usuario admin con datos de Alexandro"""
    db = SessionLocal()
    try:
        # Buscar usuario admin (ID 2)
        admin = db.query(Tecnico).filter(Tecnico.id == 2).first()
        
        if not admin:
            print("❌ Usuario admin no encontrado")
            return
        
        # Actualizar datos
        admin.usuario = "Alexandro"
        admin.nombre = "Alexandro Reynoso"
        admin.pin = "12706"
        admin.password_hash = get_password_hash("admin123")  # Mantener contraseña
        
        db.commit()
        
        print("✅ Usuario admin actualizado exitosamente")
        print("   Usuario: Alexandro")
        print("   Nombre: Alexandro Reynoso")
        print("   PIN: 12706")
        print("   Contraseña: admin123")
        print("   ID: 2")
        
    except Exception as e:
        print(f"❌ Error actualizando admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔄 Actualizando usuario admin...")
    actualizar_admin()
    print("\n🚀 Ahora puedes hacer login como 'Alexandro' y ver el panel de administración")

