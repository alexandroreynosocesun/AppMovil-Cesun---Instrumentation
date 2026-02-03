# Configuración de conectores por modelo de adaptador
# Esto define qué conectores tiene cada modelo de adaptador

ADAPTADOR_CONECTORES = {
    "MODELO_1": [
        "ZH-MINI-HD-2",  # Compartido con ZH-MINI-HD-4
        "ZH-MINI-FHD-1-68-1",  # Único
        "ZH-MINI-HD-1",  # Compartido con ZH-MINI-HD-3
        "ZH-MINI-FHD-1-51-1"  # Único
    ],
    # Puedes agregar más modelos aquí cuando los tengas
    "MODELO_2": [
        "ZH-MINI-HD-2",
        "ZH-MINI-FHD-1-68-1",
        "ZH-MINI-HD-1",
        "ZH-MINI-FHD-1-51-1"
    ],
    "ADA20100_01": [
        "ZH-MINI-HD-2",
        "ZH-MINI-HD-4",
        "ZH-MINI-FHD-1-68-1",
        "ZH-MINI-HD-1",
        "ZH-MINI-HD-3",
        "ZH-MINI-FHD-1-51-1"
    ],
    "ADA20100_02": [
        "ZH-MINI-FHD-2-68-1",
        "ZH-MINI-FHD-2-60-1",
        "ZH-MINI-HD-2"
    ],
    "CSTH-100/ZH-S20": [
        "ZH-MINI-HD-2",
        "ZH-MINI-HD-4",
        "ZH-MINI-FHD-1-68-1",
        "ZH-MINI-HD-1",
        "ZH-MINI-HD-3",
        "ZH-MINI-FHD-1-51-1",
        "ZH-MINI-FHD-2-68-1",
        "ZH-MINI-FHD-2-60-1"
    ],
    # Convertidores - solo tienen 1 conector cada uno
    "11477": [
        "CONVERTIDOR_11477"  # Conector único del convertidor 11477
    ],
    "11479": [
        "CONVERTIDOR_11479"  # Conector único del convertidor 11479
    ],
}

# Función helper para obtener conectores de un modelo
def get_conectores_by_modelo(modelo: str) -> list:
    """Obtener lista de conectores para un modelo de adaptador"""
    return ADAPTADOR_CONECTORES.get(modelo.upper(), [])

# Función helper para obtener modelos que tienen un conector específico
def get_modelos_by_conector(nombre_conector: str) -> list:
    """Obtener lista de modelos de adaptador que tienen un conector específico"""
    modelos = []
    for modelo, conectores in ADAPTADOR_CONECTORES.items():
        if nombre_conector in conectores:
            modelos.append(modelo)
    return modelos

# Función helper para obtener lista de todos los modelos disponibles
def get_modelos_disponibles() -> list:
    """Obtener lista de todos los modelos de adaptador disponibles"""
    return list(ADAPTADOR_CONECTORES.keys())




