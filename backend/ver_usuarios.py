#!/usr/bin/env python3
"""
Script para ver usuarios registrados en la base de datos
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.models import Tecnico
from passlib.context import CryptContext

# Configurar contexto de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def ver_usuarios():
    """Mostrar todos los usuarios registrados"""
    db = SessionLocal()
    try:
        usuarios = db.query(Tecnico).all()
        
        if not usuarios:
            print("❌ No hay usuarios registrados")
            return
        
        print("👥 USUARIOS REGISTRADOS:")
        print("=" * 50)
        
        for usuario in usuarios:
            print(f"🆔 ID: {usuario.id}")
            print(f"👤 Usuario: {usuario.usuario}")
            print(f"📝 Nombre: {usuario.nombre}")
            print(f"🔢 PIN: {usuario.pin}")
            print(f"📅 Creado: {usuario.created_at}")
            print(f"✍️  Firma Digital: {'Sí' if usuario.firma_digital else 'No'}")
            print("-" * 30)
        
        print(f"\n📊 Total de usuarios: {len(usuarios)}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

def crear_usuario_admin():
    """Crear usuario administrador si no existe"""
    db = SessionLocal()
    try:
        # Verificar si ya existe admin
        admin_existente = db.query(Tecnico).filter(Tecnico.usuario == "admin").first()
        
        if admin_existente:
            print("✅ Usuario 'admin' ya existe")
            return
        
        # Crear usuario admin
        from app.auth import get_password_hash
        
        admin = Tecnico(
            usuario="admin",
            nombre="Administrador",
            pin="1234",
            password_hash=get_password_hash("admin123")
        )
        
        db.add(admin)
        db.commit()
        print("✅ Usuario 'admin' creado exitosamente")
        print("   Usuario: admin")
        print("   Contraseña: admin123")
        print("   PIN: 1234")
        
    except Exception as e:
        print(f"❌ Error creando admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔍 Verificando usuarios...")
    ver_usuarios()
    
    print("\n" + "="*50)
    print("¿Deseas crear un usuario administrador? (y/n): ", end="")
    respuesta = input().lower()
    
    if respuesta == 'y':
        crear_usuario_admin()
        print("\n🔍 Usuarios actualizados:")
        ver_usuarios()

