import os
import base64
import uuid
from datetime import datetime
from pathlib import Path

# Directorio para guardar las imágenes
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "damaged_labels"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def save_image_from_base64(base64_string: str, modelo: str) -> str:
    """
    Guarda una imagen desde Base64 y devuelve la ruta relativa del archivo.
    
    Args:
        base64_string: String Base64 de la imagen (con o sin prefijo data:image/...)
        modelo: Modelo del jig para nombrar el archivo
    
    Returns:
        Ruta relativa del archivo guardado (ej: 'damaged_labels/2025-01-15_modelo_123_abc123.jpg')
    """
    try:
        # Remover el prefijo data:image/...;base64, si existe
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decodificar Base64
        image_data = base64.b64decode(base64_string)
        
        # Generar nombre único para el archivo
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        safe_modelo = "".join(c for c in modelo if c.isalnum() or c in ('-', '_'))[:20]
        filename = f"{timestamp}_{safe_modelo}_{unique_id}.jpg"
        
        # Ruta completa del archivo
        file_path = UPLOAD_DIR / filename
        
        # Guardar el archivo
        with open(file_path, 'wb') as f:
            f.write(image_data)
        
        # Devolver ruta relativa para almacenar en la BD
        relative_path = f"damaged_labels/{filename}"
        return relative_path
        
    except Exception as e:
        print(f"Error guardando imagen: {e}")
        raise

def get_image_path(relative_path: str) -> Path:
    """
    Obtiene la ruta completa del archivo desde la ruta relativa.
    
    Args:
        relative_path: Ruta relativa almacenada en la BD (ej: 'damaged_labels/foto.jpg')
    
    Returns:
        Path completo del archivo
    """
    if not relative_path:
        return None
    
    # Si ya es una ruta absoluta, devolverla
    if os.path.isabs(relative_path):
        return Path(relative_path)
    
    # Construir ruta completa (uploads está en el directorio raíz del backend)
    base_dir = Path(__file__).parent.parent.parent
    uploads_dir = base_dir / "uploads"
    return uploads_dir / relative_path

def delete_image(relative_path: str) -> bool:
    """
    Elimina un archivo de imagen.
    
    Args:
        relative_path: Ruta relativa del archivo a eliminar
    
    Returns:
        True si se eliminó correctamente, False en caso contrario
    """
    try:
        file_path = get_image_path(relative_path)
        if file_path and file_path.exists():
            file_path.unlink()
            return True
        return False
    except Exception as e:
        print(f"Error eliminando imagen: {e}")
        return False

