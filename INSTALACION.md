# Guía de Instalación - Sistema de Validación de Jigs

## 📋 Requisitos Previos

### Backend
- Python 3.8 o superior
- pip (gestor de paquetes de Python)

### Frontend Móvil
- Node.js 16 o superior
- npm o yarn
- Expo CLI
- Android Studio (para Android) o Xcode (para iOS)

## 🚀 Instalación del Backend

### 1. Navegar al directorio del backend
```bash
cd backend
```

### 2. Crear entorno virtual (recomendado)
```bash
python -m venv venv
```

### 3. Activar entorno virtual
**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 4. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 5. Configurar variables de entorno
```bash
# Copiar archivo de ejemplo
copy env.example .env

# Editar .env con tus configuraciones
# DATABASE_URL=sqlite:///./jigs_validation.db
# ASANA_API_KEY=tu_api_key_de_asana
# ASANA_PROJECT_ID=tu_project_id_de_asana
# SECRET_KEY=tu_clave_secreta_super_segura
```

### 6. Ejecutar el servidor
```bash
python main.py
```

El servidor estará disponible en: `http://localhost:8000`

## 📱 Instalación del Frontend Móvil

### 1. Navegar al directorio móvil
```bash
cd mobile
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Instalar Expo CLI (si no lo tienes)
```bash
npm install -g @expo/cli
```

### 4. Configurar URL del backend
Editar `mobile/src/services/AuthService.js` y `mobile/src/services/JigService.js`:
```javascript
const API_BASE_URL = 'http://TU_IP_LOCAL:8000/api';
```

### 5. Ejecutar la aplicación
```bash
npx expo start
```

## 🔧 Configuración de Asana

### 1. Obtener API Key
1. Ir a [Asana Developer Console](https://app.asana.com/0/my-apps)
2. Crear una nueva aplicación
3. Copiar el Personal Access Token

### 2. Obtener Project ID
1. En Asana, ir al proyecto donde quieres subir los reportes
2. En la URL, copiar el ID del proyecto
3. Ejemplo: `https://app.asana.com/0/PROJECT_ID/board`

### 3. Configurar en .env
```env
ASANA_API_KEY=tu_personal_access_token
ASANA_PROJECT_ID=tu_project_id
```

## 📊 Base de Datos

### SQLite (por defecto)
- Se crea automáticamente al ejecutar el backend
- Archivo: `jigs_validation.db`

### PostgreSQL (opcional)
1. Instalar PostgreSQL
2. Crear base de datos
3. Configurar en .env:
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/jigs_validation
```

## 🧪 Datos de Prueba

### Crear técnico de prueba
```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "tecnico1",
    "nombre": "Juan Pérez",
    "password": "123456"
  }'
```

### Crear jig de prueba
```bash
curl -X POST "http://localhost:8000/api/jigs/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "codigo_qr": "JIG-001",
    "numero_jig": "JIG-001",
    "tipo": "manual",
    "modelo_actual": "Modelo A"
  }'
```

## 🔍 Verificación de Instalación

### Backend
1. Ir a `http://localhost:8000`
2. Deberías ver: `{"message": "Sistema de Validación de Jigs API"}`

### Frontend
1. Ejecutar `npx expo start`
2. Escanear QR con Expo Go
3. Probar login con técnico creado

## 🚨 Solución de Problemas

### Error de conexión en móvil
- Verificar que el backend esté ejecutándose
- Verificar IP en los servicios de la app móvil
- Verificar que el firewall permita conexiones en puerto 8000

### Error de permisos de cámara
- En Android: Ir a Configuración > Apps > Validación de Jigs > Permisos
- En iOS: Ir a Configuración > Privacidad > Cámara

### Error de base de datos
- Verificar que SQLite esté instalado
- Verificar permisos de escritura en el directorio

## 📞 Soporte

Para problemas técnicos, revisar:
1. Logs del backend en la consola
2. Logs de la app móvil en Expo
3. Verificar configuración de red
4. Verificar variables de entorno
