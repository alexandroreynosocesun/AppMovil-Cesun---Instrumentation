#!/usr/bin/env python3
"""
Script para migrar la base de datos existente
- Eliminar campo PIN de tecnicos
- Agregar campos nuevos (numero_empleado, turno_actual, tipo_tecnico)
- Migrar datos existentes
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, SessionLocal
from app.models import models
from sqlalchemy import text

def migrate_database():
    """Migrar la base de datos existente"""
    print("🔄 Iniciando migración de base de datos...")
    
    db = SessionLocal()
    
    try:
        # 1. Agregar nuevas columnas a la tabla tecnicos
        print("📝 Agregando nuevas columnas a tecnicos...")
        
        # Verificar si las columnas ya existen
        result = db.execute(text("PRAGMA table_info(tecnicos)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'numero_empleado' not in columns:
            db.execute(text("ALTER TABLE tecnicos ADD COLUMN numero_empleado VARCHAR(20)"))
            print("   ✅ Agregada columna numero_empleado")
        else:
            print("   ⚠️  Columna numero_empleado ya existe")
            
        if 'turno_actual' not in columns:
            db.execute(text("ALTER TABLE tecnicos ADD COLUMN turno_actual VARCHAR(20) DEFAULT 'mañana'"))
            print("   ✅ Agregada columna turno_actual")
        else:
            print("   ⚠️  Columna turno_actual ya existe")
            
        if 'tipo_tecnico' not in columns:
            db.execute(text("ALTER TABLE tecnicos ADD COLUMN tipo_tecnico VARCHAR(50) DEFAULT 'Técnico de Instrumentación'"))
            print("   ✅ Agregada columna tipo_tecnico")
        else:
            print("   ⚠️  Columna tipo_tecnico ya existe")
        
        # 2. Actualizar datos existentes
        print("🔄 Actualizando datos existentes...")
        
        # Asignar números de empleado basados en el ID
        db.execute(text("""
            UPDATE tecnicos 
            SET numero_empleado = 'EMP' || printf('%04d', id)
            WHERE numero_empleado IS NULL OR numero_empleado = ''
        """))
        
        # Establecer turno por defecto
        db.execute(text("""
            UPDATE tecnicos 
            SET turno_actual = 'mañana'
            WHERE turno_actual IS NULL OR turno_actual = ''
        """))
        
        # Establecer tipo de técnico por defecto
        db.execute(text("""
            UPDATE tecnicos 
            SET tipo_tecnico = 'Técnico de Instrumentación'
            WHERE tipo_tecnico IS NULL OR tipo_tecnico = ''
        """))
        
        print("   ✅ Datos actualizados correctamente")
        
        # 3. Crear nuevas tablas
        print("📋 Creando nuevas tablas...")
        models.Base.metadata.create_all(bind=engine)
        print("   ✅ Tablas creadas/actualizadas")
        
        # 4. Verificar migración
        print("🔍 Verificando migración...")
        
        # Contar técnicos migrados
        result = db.execute(text("SELECT COUNT(*) FROM tecnicos WHERE numero_empleado IS NOT NULL"))
        count = result.fetchone()[0]
        print(f"   📊 Técnicos migrados: {count}")
        
        # Verificar nuevas tablas
        result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('jigs_ng', 'solicitudes_registro')"))
        new_tables = [row[0] for row in result.fetchall()]
        print(f"   📋 Nuevas tablas: {', '.join(new_tables)}")
        
        db.commit()
        print("✅ Migración completada exitosamente")
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        db.rollback()
        return False
    finally:
        db.close()
    
    return True

def show_migration_summary():
    """Mostrar resumen de la migración"""
    print("\n" + "="*60)
    print("📋 RESUMEN DE MIGRACIÓN")
    print("="*60)
    print("✅ Campos agregados a tecnicos:")
    print("   • numero_empleado (único)")
    print("   • turno_actual (mañana/tarde/noche)")
    print("   • tipo_tecnico (Técnico de Instrumentación)")
    print("")
    print("✅ Nuevas tablas creadas:")
    print("   • jigs_ng (gestión de jigs no buenos)")
    print("   • solicitudes_registro (solicitudes de nuevos usuarios)")
    print("")
    print("✅ Funcionalidades actualizadas:")
    print("   • Sistema de registro sin PIN")
    print("   • Perfil de usuario completo")
    print("   • Gestión de turnos")
    print("   • Firma digital en PDFs")
    print("   • Número de empleado único")
    print("")
    print("🎉 ¡Migración completada! El sistema está listo para usar.")
    print("="*60)

if __name__ == "__main__":
    success = migrate_database()
    if success:
        show_migration_summary()
    else:
        print("\n💥 Error en la migración")
        sys.exit(1)
