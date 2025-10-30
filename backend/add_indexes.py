#!/usr/bin/env python3
"""
Script para agregar índices a la base de datos y optimizar consultas
"""

from sqlalchemy import create_engine, text
from app.core.config import settings

def add_indexes():
    """Agregar índices para optimizar consultas"""
    
    # Crear conexión a la base de datos
    engine = create_engine(settings.DATABASE_URL)
    
    indexes = [
        # Índices para tabla jigs_ng
        "CREATE INDEX IF NOT EXISTS idx_jigs_ng_estado ON jigs_ng(estado);",
        "CREATE INDEX IF NOT EXISTS idx_jigs_ng_jig_id ON jigs_ng(jig_id);",
        "CREATE INDEX IF NOT EXISTS idx_jigs_ng_tecnico_id ON jigs_ng(tecnico_id);",
        "CREATE INDEX IF NOT EXISTS idx_jigs_ng_fecha_ng ON jigs_ng(fecha_ng);",
        "CREATE INDEX IF NOT EXISTS idx_jigs_ng_created_at ON jigs_ng(created_at);",
        
        # Índices para tabla jigs
        "CREATE INDEX IF NOT EXISTS idx_jigs_numero_jig ON jigs(numero_jig);",
        "CREATE INDEX IF NOT EXISTS idx_jigs_codigo_qr ON jigs(codigo_qr);",
        "CREATE INDEX IF NOT EXISTS idx_jigs_estado ON jigs(estado);",
        "CREATE INDEX IF NOT EXISTS idx_jigs_modelo_actual ON jigs(modelo_actual);",
        
        # Índices para tabla tecnicos
        "CREATE INDEX IF NOT EXISTS idx_tecnicos_usuario ON tecnicos(usuario);",
        "CREATE INDEX IF NOT EXISTS idx_tecnicos_numero_empleado ON tecnicos(numero_empleado);",
        
        # Índices para tabla validaciones
        "CREATE INDEX IF NOT EXISTS idx_validaciones_jig_id ON validaciones(jig_id);",
        "CREATE INDEX IF NOT EXISTS idx_validaciones_tecnico_id ON validaciones(tecnico_id);",
        "CREATE INDEX IF NOT EXISTS idx_validaciones_fecha ON validaciones(fecha);",
        
        # Índices para tabla reparaciones
        "CREATE INDEX IF NOT EXISTS idx_reparaciones_jig_id ON reparaciones(jig_id);",
        "CREATE INDEX IF NOT EXISTS idx_reparaciones_tecnico_id ON reparaciones(tecnico_id);",
        "CREATE INDEX IF NOT EXISTS idx_reparaciones_fecha ON reparaciones(fecha);",
    ]
    
    try:
        with engine.connect() as conn:
            print("Agregando índices a la base de datos...")
            
            for i, index_sql in enumerate(indexes, 1):
                try:
                    conn.execute(text(index_sql))
                    print(f"✅ Índice {i}/{len(indexes)} creado exitosamente")
                except Exception as e:
                    print(f"⚠️  Error creando índice {i}: {e}")
            
            conn.commit()
            print("\n🎉 Todos los índices han sido procesados!")
            
    except Exception as e:
        print(f"❌ Error conectando a la base de datos: {e}")
        return False
    
    return True

def analyze_tables():
    """Analizar tablas para verificar índices"""
    
    engine = create_engine(settings.DATABASE_URL)
    
    analysis_queries = [
        "SELECT COUNT(*) as total_jigs_ng FROM jigs_ng;",
        "SELECT COUNT(*) as total_jigs FROM jigs;",
        "SELECT COUNT(*) as total_tecnicos FROM tecnicos;",
        """
        SELECT 
            estado, 
            COUNT(*) as cantidad 
        FROM jigs_ng 
        GROUP BY estado 
        ORDER BY cantidad DESC;
        """,
    ]
    
    try:
        with engine.connect() as conn:
            print("\n📊 Análisis de la base de datos:")
            print("=" * 50)
            
            for i, query in enumerate(analysis_queries, 1):
                try:
                    result = conn.execute(text(query))
                    rows = result.fetchall()
                    
                    if i <= 3:  # Consultas de conteo
                        print(f"Total registros: {rows[0][0]}")
                    else:  # Consulta de estados
                        print("\nEstados de Jigs NG:")
                        for row in rows:
                            print(f"  {row[0]}: {row[1]} registros")
                            
                except Exception as e:
                    print(f"Error en consulta {i}: {e}")
                    
    except Exception as e:
        print(f"❌ Error analizando base de datos: {e}")

if __name__ == "__main__":
    print("🚀 Optimizando base de datos...")
    print("=" * 50)
    
    # Agregar índices
    if add_indexes():
        # Analizar tablas
        analyze_tables()
        print("\n✅ Optimización completada!")
    else:
        print("\n❌ Error en la optimización")
