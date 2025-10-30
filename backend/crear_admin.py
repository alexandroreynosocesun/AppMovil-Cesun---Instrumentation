#!/usr/bin/env python3
"""
Script para crear usuario administrador inicial
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.models import Tecnico
from app.auth import get_password_hash

def crear_admin():
    """Crear usuario administrador si no existe"""
    db = SessionLocal()
    try:
        # Verificar si ya existe admin
        admin_existente = db.query(Tecnico).filter(Tecnico.usuario == "admin").first()
        
        if admin_existente:
            print("✅ Usuario 'admin' ya existe")
            print(f"   ID: {admin_existente.id}")
            print(f"   Nombre: {admin_existente.nombre}")
            print(f"   PIN: {admin_existente.pin}")
            return
        
        # Crear usuario admin
        admin = Tecnico(
            usuario="admin",
            nombre="Administrador del Sistema",
            pin="1234",
            password_hash=get_password_hash("adminAlex")
        )
        
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        print("✅ Usuario 'admin' creado exitosamente")
        print("   Usuario: admin")
        print("   Contraseña: admin123")
        print("   PIN: 1234")
        print("   ID:", admin.id)
        
    except Exception as e:
        print(f"❌ Error creando admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔐 Creando usuario administrador...")
    crear_admin()
    print("\n🚀 Ahora puedes usar el panel de administración en la app móvil")
