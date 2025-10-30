#!/usr/bin/env python3
"""
Script para actualizar la base de datos con las nuevas tablas de jigs NG
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from app.models import models

def update_database():
    """Crear las nuevas tablas en la base de datos"""
    print("Actualizando base de datos...")
    
    try:
        # Crear todas las tablas (incluyendo las nuevas)
        models.Base.metadata.create_all(bind=engine)
        print("✅ Base de datos actualizada correctamente")
        print("📋 Nuevas tablas creadas:")
        print("   - jigs_ng")
        print("   - solicitudes_registro")
        print("   - Relaciones actualizadas en jigs")
        print("   - Campos actualizados en tecnicos:")
        print("     * numero_empleado (nuevo)")
        print("     * turno_actual (nuevo)")
        print("     * tipo_tecnico (nuevo)")
        print("     * pin (eliminado)")
        print("   - Campos actualizados en solicitudes_registro:")
        print("     * numero_empleado (nuevo)")
        print("     * pin (eliminado)")
        
    except Exception as e:
        print(f"❌ Error actualizando base de datos: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = update_database()
    if success:
        print("\n🎉 ¡Actualización completada!")
        print("💡 Ahora puedes usar la funcionalidad de jigs NG")
    else:
        print("\n💥 Error en la actualización")
        sys.exit(1)
