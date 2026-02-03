# Este archivo hace que Python reconozca 'config' como un paquete
# Importa todo del módulo config.py del nivel superior para mantener compatibilidad

import sys
from pathlib import Path

# Importar el módulo config.py del nivel superior
_config_path = Path(__file__).parent.parent / 'config.py'

# Leer y ejecutar el contenido del archivo config.py
with open(_config_path, 'r', encoding='utf-8') as f:
    _config_code = f.read()
    
# Crear un namespace para ejecutar el código
# Incluir __file__ para que el código de config.py funcione correctamente
_config_namespace = {
    '__file__': str(_config_path),
    '__name__': 'app.config.config',
    '__package__': 'app.config',
}
exec(_config_code, _config_namespace)

# Exportar todas las variables que no empiecen con _
for key, value in _config_namespace.items():
    if not key.startswith('_'):
        globals()[key] = value

