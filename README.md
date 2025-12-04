# 📱 Sistema de Validación de Jigs - Aplicación Móvil

Sistema integral para la gestión, validación y seguimiento de jigs industriales, proporcionando una solución completa para el control de calidad y mantenimiento de equipos de producción.

## 🎯 Características Principales

- ✅ **Gestión completa de Jigs** - Registro, seguimiento y validación de jigs industriales
- ✅ **Sistema de Validaciones** - Validación digital con firmas electrónicas y reportes automáticos
- ✅ **Jigs NG (No Conformes)** - Gestión completa de jigs con problemas y seguimiento de reparaciones
- ✅ **Escaneo QR** - Identificación rápida mediante códigos QR
- ✅ **Generación de Reportes PDF** - Reportes profesionales con firmas digitales
- ✅ **Sistema de Auditoría** - Trazabilidad completa de todos los PDFs generados
- ✅ **Gestión de Etiquetas Dañadas** - Reporte y seguimiento de etiquetas dañadas
- ✅ **Almacenamiento Inteligente** - Gestión automática de almacenamiento de PDFs
- ✅ **Sistema de Usuarios** - Roles, permisos y gestión de solicitudes de registro
- ✅ **Soporte Multiplataforma** - Web, Android e iOS

---

## 🛠️ Tecnologías Utilizadas

### **Frontend - Aplicación Móvil**
- **React Native** - Framework principal para desarrollo móvil multiplataforma
- **Expo** - Plataforma de desarrollo y despliegue
- **React Navigation** - Navegación entre pantallas
- **React Native Paper** - Librería de componentes Material Design
- **AsyncStorage** - Almacenamiento local de datos
- **Expo SecureStore** - Almacenamiento seguro de credenciales
- **Expo Barcode Scanner** - Escaneo de códigos QR
- **React Native Signature Canvas** - Captura de firmas digitales

### **Backend - API REST**
- **Python 3.11+** - Lenguaje de programación principal
- **FastAPI** - Framework web moderno y rápido
- **SQLAlchemy** - ORM para manejo de base de datos
- **Alembic** - Migraciones de base de datos
- **Pydantic** - Validación de datos y serialización
- **JWT** - Autenticación basada en tokens
- **PostgreSQL** - Base de datos relacional principal
- **Redis** - Sistema de caché para optimización
- **ReportLab** - Generación de PDFs profesionales

### **Servicios y Utilidades**
- **Prometheus** - Monitoreo y métricas
- **Sentry** - Monitoreo de errores
- **Schedule** - Tareas programadas (limpieza automática)
- **Python-dotenv** - Gestión de variables de entorno

---

## 📱 Pantallas Implementadas

### **🔐 Autenticación y Registro**
1. **LoginScreen** - Inicio de sesión de usuarios
2. **RegisterScreen** - Registro de nuevos usuarios
3. **SolicitudStatusScreen** - Estado de solicitudes de registro

### **🏠 Pantallas Principales**
4. **HomeScreen** - Dashboard principal con estadísticas y acceso rápido
5. **ProfileScreen** - Perfil de usuario y gestión de firma digital
6. **QRScannerScreen** - Escáner de códigos QR para identificación rápida

### **🔧 Gestión de Jigs**
7. **AllJigsScreen** - Vista completa de jigs con filtros avanzados y múltiples vistas
8. **AddJigScreen** - Registro de nuevos jigs
9. **ValidationScreen** - Proceso de validación de jigs con firma digital
10. **RepairJigScreen** - Gestión de reparaciones de jigs

### **❌ Jigs NG (No Conformes)**
11. **JigNGScreen** - Gestión de jigs con problemas
12. **AddJigNGScreen** - Reporte de jigs NG con captura de fotos
13. **JigNGDetailScreen** - Detalles y seguimiento de reparaciones

### **📊 Reportes y Documentación**
14. **ReporteScreen** - Generación de reportes PDF por modelo y turno
15. **PDFPreviewScreen** - Vista previa de reportes PDF generados
16. **AuditoriaScreen** - Sistema de auditoría de PDFs generados

### **👥 Administración**
17. **AdminScreen** - Panel de administración de usuarios
18. **AdminSolicitudesScreen** - Gestión de solicitudes de registro
19. **AssignValidationScreen** - Asignación de validaciones a técnicos
20. **AssignedValidationsScreen** - Validaciones asignadas
21. **ActiveValidationsScreen** - Validaciones activas en curso

### **🏷️ Gestión de Etiquetas**
22. **DamagedLabelScreen** - Reporte de etiquetas dañadas con foto
23. **DamagedLabelsListScreen** - Lista de etiquetas dañadas reportadas

### **💾 Almacenamiento**
24. **StorageManagementScreen** - Gestión de almacenamiento de PDFs (solo admin)

---

## 🎬 Demo Funcional - App Móvil (Tecnología Libre)

### ✅ Requisitos Cumplidos

- ✅ **Tecnología Libre**: React Native con Expo (framework de código abierto)
- ✅ **Pantallas Implementadas**: 
  - **Splash Screen** - Pantalla de inicio configurada automáticamente por Expo
  - **HomeScreen** - Pantalla principal con dashboard y acceso rápido a funcionalidades
  - **ProfileScreen** - Pantalla de perfil y configuración de usuario
  - **LoginScreen** - Sistema de autenticación completo
- ✅ **Navegación**: React Navigation implementada y funcional con Stack Navigator
- ✅ **UI Responsive**: Interfaz adaptada a dispositivos móviles, tablets y web
- ✅ **Funcionalidad Básica**: Sistema completo de autenticación, navegación y gestión de perfil

### 🎯 Pantallas de la Demo

#### 1. **Splash Screen**
- Configurado automáticamente por Expo al iniciar la aplicación
- Se muestra durante la carga inicial de la app
- Imagen de splash personalizada en `assets/splash.png`

#### 2. **Pantalla Principal (HomeScreen)**
- Dashboard con estadísticas y métricas
- Acceso rápido a funcionalidades principales
- Navegación intuitiva a otras secciones
- Diseño responsive adaptado a diferentes tamaños de pantalla

#### 3. **Pantalla de Perfil (ProfileScreen)**
- Gestión completa de perfil de usuario
- Edición de datos personales
- Cambio de contraseña
- Configuración de turno de trabajo
- Gestión de firma digital

### 🚀 Instalación Rápida para Demo

#### Prerrequisitos
- Node.js 18+ y npm
- Expo CLI: `npm install -g expo-cli` (opcional, Expo Go funciona sin instalación)

#### Pasos de Instalación

1. **Navegar a la carpeta mobile**
   ```bash
   cd mobile
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Ejecutar aplicación**
   ```bash
   # Iniciar servidor de desarrollo
   npm start
   
   # Luego presionar:
   # - 'w' para web (navegador)
   # - 'a' para Android (emulador o dispositivo)
   # - 'i' para iOS (simulador o dispositivo)
   ```

4. **Configurar Backend (opcional para demo básica)**
   - La app puede funcionar en modo offline básico
   - Para funcionalidad completa, configurar URL del backend en los servicios de API

### 🎯 Funcionalidades Demostrables

- ✅ **Navegación fluida**: Transiciones suaves entre pantallas con React Navigation
- ✅ **Interfaz adaptativa**: Diseño responsive que se adapta a diferentes tamaños de pantalla (móvil, tablet, web)
- ✅ **Autenticación**: Sistema completo de login y registro de usuarios
- ✅ **Gestión de perfil**: Edición de datos de usuario, cambio de contraseña y configuración
- ✅ **UI Moderna**: Diseño profesional con Material Design (React Native Paper) y animaciones
- ✅ **Splash Screen**: Pantalla de inicio automática configurada por Expo

### 🛠️ Tecnologías Utilizadas (Código Libre)

- **React Native** - Framework multiplataforma de código libre (MIT License)
- **Expo** - Plataforma de desarrollo y despliegue (MIT License)
- **React Navigation** - Sistema de navegación (MIT License)
- **React Native Paper** - Componentes Material Design (MIT License)
- **Expo Linear Gradient** - Gradientes para UI moderna (MIT License)

### 📋 Estructura de Navegación

```
App
├── Splash Screen (automático - Expo)
├── LoginScreen (no autenticado)
│   ├── RegisterScreen
│   └── SolicitudStatusScreen
└── HomeScreen (autenticado)
    ├── ProfileScreen
    ├── QRScannerScreen
    ├── ValidationScreen
    └── ... (más pantallas)
```

### ✅ Verificación de Requisitos

La aplicación cumple con todos los requisitos de la demo funcional:

- ✅ **App compila sin errores**: `npm start` funciona correctamente
- ✅ **Navegación fluida**: Transiciones suaves entre todas las pantallas
- ✅ **Interfaz adaptada**: Diseño responsive para dispositivos móviles
- ✅ **Demo básica**: Funcionalidades principales demostrables (autenticación, navegación, perfil)

---

## 🚀 Funcionalidades Principales

### **1. Gestión de Jigs**
- ✅ Registro de jigs con código QR único
- ✅ Clasificación por tipo (Manual, Semiautomático, New Semiautomático)
- ✅ Seguimiento de modelo actual
- ✅ Estados: activo, inactivo, en reparación
- ✅ Búsqueda y filtros avanzados
- ✅ Vista por tipo, modelo o lista completa
- ✅ Historial completo de cada jig

### **2. Sistema de Validaciones**
- ✅ Validación digital con firma electrónica
- ✅ Captura de datos técnicos
- ✅ Registro de observaciones
- ✅ Asignación de validaciones a técnicos
- ✅ Validaciones por modelo (14 validaciones por modelo)
- ✅ Generación automática de reportes
- ✅ Seguimiento de validaciones activas

### **3. Jigs NG (No Conformes)**
- ✅ Reporte de problemas con foto
- ✅ Categorización de problemas
- ✅ Asignación de responsables de reparación
- ✅ Seguimiento de estados: Pendiente, En Reparación, Reparado, Falso Defecto
- ✅ Comentarios de reparación
- ✅ Dashboard de estadísticas
- ✅ Historial completo de reparaciones

### **4. Generación de Reportes**
- ✅ Reportes PDF profesionales
- ✅ Inclusión de firmas digitales
- ✅ Datos completos de validación
- ✅ Reportes por modelo y turno
- ✅ Reportes de lote
- ✅ Descarga y compartir
- ✅ Vista previa antes de generar

### **5. Sistema de Auditoría**
- ✅ Trazabilidad completa de PDFs generados
- ✅ Filtros por fecha, turno, línea
- ✅ Búsqueda de reportes
- ✅ Información detallada de cada reporte
- ✅ Descarga de reportes históricos

### **6. Gestión de Etiquetas Dañadas**
- ✅ Reporte de etiquetas dañadas con foto
- ✅ Lista de etiquetas reportadas
- ✅ Información del técnico que reportó
- ✅ Fecha y hora del reporte

### **7. Sistema de Usuarios**
- ✅ Autenticación segura con JWT
- ✅ Roles de usuario: admin, ingeniero, técnico, inventario, asignaciones
- ✅ Gestión de perfiles
- ✅ Solicitudes de registro con aprobación
- ✅ Número de empleado único
- ✅ Gestión de turnos (A, B, C)
- ✅ Firma digital por usuario

### **8. Almacenamiento Inteligente**
- ✅ Gestión automática de almacenamiento
- ✅ Limpieza automática de PDFs antiguos
- ✅ Compresión de archivos antiguos
- ✅ Monitoreo de uso de disco
- ✅ Estadísticas de almacenamiento

---

## 📊 Características Técnicas

### **Arquitectura**
- **Frontend:** React Native con Expo (Web, Android, iOS)
- **Backend:** FastAPI con SQLAlchemy
- **Base de Datos:** PostgreSQL
- **Caché:** Redis para optimización
- **Autenticación:** JWT tokens
- **Comunicación:** REST API con paginación

### **Seguridad**
- ✅ Autenticación JWT con expiración
- ✅ Almacenamiento seguro de credenciales (Expo SecureStore)
- ✅ Validación de datos en frontend y backend
- ✅ Manejo seguro de firmas digitales
- ✅ Protección de endpoints con roles
- ✅ Encriptación de contraseñas (bcrypt)

### **UX/UI**
- ✅ Diseño profesional con tema oscuro
- ✅ Navegación intuitiva
- ✅ Componentes reutilizables
- ✅ Feedback visual para acciones
- ✅ Manejo de errores user-friendly
- ✅ Soporte offline básico
- ✅ Indicador de conexión
- ✅ Responsive design (Web, Tablet, Mobile)

### **Rendimiento**
- ✅ Sistema de caché con Redis
- ✅ Paginación en todas las listas
- ✅ Optimización de consultas SQL
- ✅ Índices en base de datos
- ✅ Compresión de imágenes
- ✅ Limpieza automática de archivos antiguos

---

## 📦 Instalación y Configuración

### **Prerrequisitos**
- Node.js 18+ y npm
- Python 3.11+
- PostgreSQL
- Redis (opcional, para caché)

### **Backend**

1. **Clonar el repositorio**
```bash
cd backend
```

2. **Crear entorno virtual**
```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

3. **Instalar dependencias**
```bash
pip install -r requirements.txt
```

4. **Configurar variables de entorno**
```bash
cp env.example .env
```

Editar `.env` con tus configuraciones:
```env
# PostgreSQL (requerido):
DATABASE_URL=postgresql+psycopg2://usuario:password@localhost:5432/jigs_validation

# SQLite (solo para desarrollo local, opcional):
# DATABASE_URL=sqlite:///./jigs_validation.db

SECRET_KEY=tu_secret_key_aqui
REDIS_URL=redis://localhost:6379  # Opcional
```

5. **Inicializar base de datos**
```bash
# Si usas Alembic para migraciones:
alembic upgrade head

# O crear tablas directamente:
python -c "from app.database import engine; from app.models import models; models.Base.metadata.create_all(bind=engine)"
```

6. **Crear usuario administrador**
```bash
python crear_admin.py
```

7. **Ejecutar servidor**
```bash
uvicorn main:app --reload
```

El servidor estará disponible en `http://localhost:8000`

### **Frontend (Mobile)**

1. **Navegar a la carpeta mobile**
```bash
cd mobile
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar API URL**
Editar el archivo de configuración de servicios para apuntar a tu backend.

4. **Ejecutar aplicación**
```bash
# Desarrollo
npm start

# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

---

## 📁 Estructura del Proyecto

```
APP Movil/
├── backend/                 # Backend FastAPI
│   ├── app/
│   │   ├── models/         # Modelos de base de datos
│   │   ├── routers/        # Endpoints de la API
│   │   ├── services/       # Lógica de negocio
│   │   ├── tasks/          # Tareas programadas
│   │   ├── utils/          # Utilidades
│   │   ├── auth.py         # Autenticación
│   │   ├── config.py       # Configuración
│   │   ├── database.py     # Conexión a BD
│   │   └── schemas.py      # Esquemas Pydantic
│   ├── alembic/            # Migraciones de BD
│   ├── tests/              # Tests unitarios
│   ├── main.py             # Punto de entrada
│   ├── requirements.txt    # Dependencias Python
│   └── alembic.ini         # Configuración Alembic
│
├── mobile/                  # Aplicación React Native
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── contexts/       # Contextos de React
│   │   ├── hooks/          # Custom hooks
│   │   ├── screens/        # Pantallas de la app
│   │   ├── services/       # Servicios de API
│   │   └── utils/          # Utilidades
│   ├── App.js              # Componente principal
│   ├── package.json        # Dependencias Node
│   └── app.json           # Configuración Expo
│
└── README.md               # Este archivo
```

---

## 🔌 API Endpoints Principales

### **Autenticación**
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Solicitar registro

### **Jigs**
- `GET /api/jigs/` - Listar jigs (paginado)
- `GET /api/jigs/qr/{codigo_qr}` - Obtener jig por QR
- `POST /api/jigs/` - Crear nuevo jig
- `PUT /api/jigs/{id}` - Actualizar jig
- `DELETE /api/jigs/{id}` - Eliminar jig

### **Validaciones**
- `POST /api/validations/` - Crear validación
- `GET /api/validations/` - Listar validaciones
- `GET /api/validations/{id}` - Obtener validación
- `POST /api/validations/assign` - Asignar validación

### **Jigs NG**
- `GET /api/jigs-ng/` - Listar jigs NG
- `POST /api/jigs-ng/` - Crear jig NG
- `PUT /api/jigs-ng/{id}` - Actualizar jig NG
- `PUT /api/jigs-ng/{id}/reparar` - Marcar como reparado

### **Reportes**
- `POST /api/validations/generate-pdf` - Generar PDF de validación
- `POST /api/validations/generate-turn-report` - Generar reporte de turno
- `GET /api/validations/download-pdf/{filename}` - Descargar PDF

### **Auditoría**
- `GET /api/auditoria/pdfs` - Listar PDFs generados
- `GET /api/auditoria/pdfs/{id}` - Obtener detalles de PDF

### **Administración**
- `GET /api/admin/users` - Listar usuarios
- `PUT /api/admin/users/{id}` - Actualizar usuario
- `GET /api/admin/solicitudes` - Listar solicitudes
- `PUT /api/admin/solicitudes/{id}` - Aprobar/rechazar solicitud

### **Etiquetas Dañadas**
- `POST /api/damaged-labels/` - Reportar etiqueta dañada
- `GET /api/damaged-labels/` - Listar etiquetas dañadas

### **Almacenamiento**
- `GET /api/storage/status` - Estado del almacenamiento
- `POST /api/storage/cleanup` - Limpiar archivos antiguos

---

## 🧪 Testing

### **Backend**
```bash
cd backend
pytest
```

### **Frontend**
Las pruebas se pueden ejecutar con las herramientas de testing de React Native.

---

## 📝 Scripts Útiles

### **Backend**
- `crear_admin.py` - Crear usuario administrador
- `cambiar_tipo_usuario.py` - Cambiar tipo de usuario
- `ver_usuarios.py` - Ver usuarios registrados
- `add_indexes.py` - Agregar índices a la BD
- `migrate_database.py` - Migrar base de datos
- `migrate_to_postgresql.py` - Migrar datos a PostgreSQL

---

## 🔒 Seguridad

- Las contraseñas se almacenan con hash bcrypt
- Los tokens JWT tienen expiración configurable
- Validación de datos en todos los endpoints
- Protección CSRF en formularios
- Sanitización de inputs
- Logs de auditoría para acciones críticas

---

## 📈 Monitoreo

- **Prometheus** - Métricas de rendimiento
- **Sentry** - Monitoreo de errores
- **Logs estructurados** - Sistema de logging completo
- **Tareas programadas** - Limpieza automática de archivos

---

## 🚀 Despliegue

### **Backend**
1. Configurar variables de entorno de producción
2. Configurar base de datos PostgreSQL
3. Ejecutar migraciones: `alembic upgrade head`
4. Configurar servidor web (Nginx + Gunicorn/Uvicorn)

### **Frontend**
1. Configurar URL de API de producción
2. Build de la aplicación:
   ```bash
   expo build:android
   expo build:ios
   ```
3. Publicar en tiendas de aplicaciones

---

## 👥 Roles de Usuario

- **admin** - Acceso completo al sistema
- **ingeniero** - Gestión de validaciones y asignaciones
- **tecnico** - Validación de jigs y reportes
- **inventario** - Gestión de inventario
- **asignaciones** - Asignación de validaciones

---

## 📞 Soporte

Para más información sobre este proyecto o consultas técnicas, contactar al equipo de desarrollo.

---

## 📄 Licencia

Este proyecto es privado y de uso interno.

---

*Sistema integral para la gestión moderna de jigs industriales, combinando las mejores prácticas de desarrollo móvil con un diseño centrado en el usuario y arquitectura escalable.*
