# PRIMER AVANCE SEMANAL

## Sistema de Validación de Jigs - Aplicación Móvil

---

<div style="page-break-after: always;"></div>

# PORTADA

## PROYECTO: SISTEMA DE VALIDACIÓN DE JIGS
### Aplicación Móvil para Gestión y Control de Calidad

---

**INSTITUCIÓN:**  
CESUN - Centro de Estudios Superiores del Noroeste

**CARRERA:**  
Ingeniería en Sistemas / Tecnologías de la Información

**ASIGNATURA:**  
Desarrollo de Aplicaciones Móviles / Instrumentación

**PERÍODO:**  
2025

---

**INTEGRANTES DEL EQUIPO:**

- [Alexandro Arturo Reynoso Vazquez]


---

**FECHA DE ENTREGA:**  
Noviembre 2025

**REPOSITORIO GITHUB:**  
https://github.com/alexandroreynosocesun/AppMovil-Cesun---Instrumentation

---

<div style="page-break-after: always;"></div>

# 1. INTRODUCCIÓN

## 1.1 Contexto del Proyecto

El **Sistema de Validación de Jigs** es una aplicación móvil desarrollada para optimizar y digitalizar el proceso de gestión, validación y seguimiento de jigs industriales en entornos de producción. Este proyecto surge de la necesidad de modernizar los procesos manuales de control de calidad y mantenimiento de equipos de producción.

## 1.2 Problema Identificado

En la industria manufacturera, la gestión de jigs (herramientas de sujeción y posicionamiento) presenta varios desafíos:

- **Falta de trazabilidad**: No existe un sistema centralizado para rastrear el estado y validación de cada jig
- **Procesos manuales**: La documentación y reportes se realizan de forma manual, propensa a errores
- **Dificultad de seguimiento**: Es complicado rastrear el estado de reparaciones y validaciones
- **Falta de integración**: Los diferentes departamentos no comparten información de manera eficiente
- **Ineficiencia en reportes**: La generación de reportes es lenta y requiere trabajo manual adicional

## 1.3 Justificación

La implementación de una solución móvil digital permitirá:

- Centralizar toda la información de jigs en un solo sistema
- Automatizar la generación de reportes y documentación
- Mejorar la trazabilidad y control de calidad
- Reducir errores humanos en el proceso de validación
- Facilitar el acceso a información desde cualquier lugar
- Agilizar el proceso de validación y reporte de problemas

---

<div style="page-break-after: always;"></div>

# 2. OBJETIVOS

## 2.1 Objetivo General

Desarrollar una aplicación móvil integral para la gestión, validación y seguimiento de jigs industriales, proporcionando una solución completa para el control de calidad y mantenimiento de equipos de producción mediante tecnologías móviles modernas.

## 2.2 Objetivos Específicos

### 2.2.1 Gestión de Jigs
- Implementar un sistema de registro y catalogación de jigs con identificación mediante códigos QR
- Permitir la clasificación de jigs por tipo (Manual, Semiautomático, New Semiautomático)
- Facilitar la búsqueda y filtrado de jigs por diferentes criterios

### 2.2.2 Sistema de Validaciones
- Desarrollar un módulo de validación digital con captura de firma electrónica
- Implementar registro de datos técnicos y observaciones durante la validación
- Generar reportes automáticos en formato PDF con toda la información de validación

### 2.2.3 Gestión de Jigs NG (No Conformes)
- Crear un sistema para reportar jigs con problemas o defectos
- Implementar seguimiento de estados de reparación (Pendiente, En Reparación, Reparado, Falso Defecto)
- Permitir asignación de responsables y registro de comentarios de reparación

### 2.2.4 Sistema de Usuarios y Seguridad
- Implementar autenticación segura mediante tokens JWT
- Desarrollar sistema de roles y permisos
- Gestionar perfiles de usuario con firma digital

### 2.2.5 Reportes y Documentación
- Generar reportes PDF profesionales con información completa
- Incluir firmas digitales en los reportes
- Permitir descarga y compartir reportes generados

---

<div style="page-break-after: always;"></div>

# 3. TECNOLOGÍAS SELECCIONADAS

## 3.1 Frontend - Aplicación Móvil

### 3.1.1 React Native
- **Justificación**: Framework multiplataforma que permite desarrollar para iOS y Android con un solo código base
- **Versión**: Compatible con React Native 0.81.4
- **Ventajas**: 
  - Desarrollo eficiente multiplataforma
  - Gran comunidad y documentación
  - Acceso a APIs nativas

### 3.1.2 Expo
- **Justificación**: Plataforma que simplifica el desarrollo y despliegue de aplicaciones React Native
- **Versión**: Expo SDK ~54.0.0
- **Ventajas**:
  - Desarrollo rápido sin necesidad de configurar entornos nativos
  - Herramientas de desarrollo integradas
  - Actualizaciones OTA (Over The Air)

### 3.1.3 React Navigation
- **Justificación**: Librería estándar para navegación en aplicaciones React Native
- **Versión**: ^6.1.9
- **Uso**: Navegación entre pantallas, stacks, tabs y drawers

### 3.1.4 React Native Paper
- **Justificación**: Librería de componentes Material Design para React Native
- **Versión**: ^5.11.1
- **Uso**: Componentes UI consistentes y profesionales

### 3.1.5 Almacenamiento Local
- **AsyncStorage**: Almacenamiento local de datos no sensibles
- **Expo SecureStore**: Almacenamiento seguro de credenciales y tokens

### 3.1.6 Otras Librerías Frontend
- **Axios**: Cliente HTTP para comunicación con API
- **Expo Barcode Scanner**: Escaneo de códigos QR
- **Expo Camera**: Captura de imágenes
- **React Native Signature Canvas**: Captura de firmas digitales
- **Expo SQLite**: Base de datos local para modo offline

## 3.2 Backend - API REST

### 3.2.1 Python
- **Justificación**: Lenguaje versátil y potente para desarrollo backend
- **Versión**: Python 3.8 o superior
- **Ventajas**: Sintaxis clara, gran ecosistema de librerías

### 3.2.2 FastAPI
- **Justificación**: Framework web moderno, rápido y fácil de usar para APIs REST
- **Ventajas**:
  - Alto rendimiento
  - Documentación automática (Swagger/OpenAPI)
  - Validación automática de datos
  - Soporte nativo para async/await

### 3.2.3 SQLAlchemy
- **Justificación**: ORM (Object-Relational Mapping) para Python
- **Uso**: Abstracción de base de datos, modelos y consultas

### 3.2.4 SQLite
- **Justificación**: Base de datos ligera y embebida, perfecta para desarrollo y producción pequeña/mediana
- **Ventajas**: 
  - No requiere servidor separado
  - Fácil de configurar y mantener
  - Adecuada para el alcance del proyecto

### 3.2.5 Pydantic
- **Justificación**: Validación de datos y serialización
- **Uso**: Validación de esquemas de datos en la API

### 3.2.6 JWT (JSON Web Tokens)
- **Justificación**: Autenticación segura y stateless
- **Uso**: Autenticación de usuarios sin necesidad de sesiones

## 3.3 Generación de Documentos

### 3.3.1 ReportLab
- **Justificación**: Librería Python para generación de PDFs
- **Uso**: Creación de reportes profesionales con firmas digitales

### 3.3.2 Base64
- **Justificación**: Codificación de imágenes (firmas digitales) para inclusión en PDFs

## 3.4 Herramientas de Desarrollo

### 3.4.1 Git y GitHub
- **Justificación**: Control de versiones y colaboración
- **Repositorio**: https://github.com/alexandroreynosocesun/AppMovil-Cesun---Instrumentation

### 3.4.2 ngrok
- **Justificación**: Túnel para exponer servidor local durante desarrollo
- **Uso**: Permitir que la app móvil se conecte al backend local

### 3.4.3 Node.js y npm
- **Justificación**: Entorno de ejecución y gestor de paquetes para React Native
- **Versión**: Node.js 16 o superior

## 3.4 Resumen de Stack Tecnológico

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Frontend Framework** | React Native | 0.81.4 |
| **Plataforma Móvil** | Expo | ~54.0.0 |
| **Navegación** | React Navigation | ^6.1.9 |
| **UI Components** | React Native Paper | ^5.11.1 |
| **Backend Framework** | FastAPI | Latest |
| **Lenguaje Backend** | Python | 3.8+ |
| **Base de Datos** | SQLite | - |
| **ORM** | SQLAlchemy | Latest |
| **Autenticación** | JWT | - |
| **Generación PDF** | ReportLab | Latest |
| **Control Versiones** | Git/GitHub | - |

---

<div style="page-break-after: always;"></div>

# 4. AVANCES DE INSTALACIÓN Y CONFIGURACIÓN

## 4.1 Configuración del Entorno de Desarrollo

### 4.1.1 Instalación de Node.js y npm
- ✅ Node.js instalado (versión 16 o superior)
- ✅ npm configurado correctamente
- ✅ Verificación mediante `node --version` y `npm --version`

### 4.1.2 Instalación de Expo CLI
```bash
npm install -g @expo/cli
```
- ✅ Expo CLI instalado globalmente
- ✅ Verificación mediante `expo --version`

### 4.1.3 Instalación de Python
- ✅ Python 3.8 o superior instalado
- ✅ pip (gestor de paquetes) configurado
- ✅ Verificación mediante `python --version`

### 4.1.4 Instalación de Git
- ✅ Git instalado y configurado
- ✅ Repositorio clonado desde GitHub
- ✅ Configuración de usuario y email

## 4.2 Configuración del Backend

### 4.2.1 Estructura del Proyecto Backend
```
backend/
├── app/
│   ├── __init__.py
│   ├── database.py          # Configuración de base de datos
│   ├── auth.py              # Autenticación JWT
│   ├── schemas.py           # Esquemas Pydantic
│   ├── models/              # Modelos SQLAlchemy
│   ├── routers/             # Endpoints de la API
│   ├── services/            # Lógica de negocio
│   └── utils/               # Utilidades
├── main.py                  # Punto de entrada
├── run.py                   # Script de ejecución
├── requirements.txt         # Dependencias Python
└── .env                     # Variables de entorno
```

### 4.2.2 Creación del Entorno Virtual
```bash
cd backend
python -m venv venv
```
- ✅ Entorno virtual creado
- ✅ Activación del entorno virtual configurada

### 4.2.3 Instalación de Dependencias del Backend
```bash
pip install -r requirements.txt
```
- ✅ Todas las dependencias instaladas correctamente:
  - FastAPI
  - SQLAlchemy
  - Pydantic
  - python-jose (JWT)
  - passlib (hashing de contraseñas)
  - python-multipart
  - ReportLab (generación de PDFs)
  - uvicorn (servidor ASGI)

### 4.2.4 Configuración de Base de Datos
- ✅ SQLite configurada como base de datos
- ✅ Modelos de base de datos creados:
  - Modelo de Usuarios (Tecnico)
  - Modelo de Jigs
  - Modelo de Validaciones
  - Modelo de Jigs NG (No Conformes)
- ✅ Migraciones de base de datos ejecutadas
- ✅ Base de datos inicializada con estructura correcta

### 4.2.5 Configuración de Variables de Entorno
- ✅ Archivo `.env` configurado
- ✅ Variables configuradas:
  - `DATABASE_URL`: URL de conexión a base de datos
  - `SECRET_KEY`: Clave secreta para JWT
  - Configuraciones adicionales según necesidad

### 4.2.6 Ejecución del Servidor Backend
```bash
python run.py
```
- ✅ Servidor ejecutándose en `http://localhost:8000`
- ✅ Documentación API disponible en `/docs` (Swagger UI)
- ✅ Endpoints probados y funcionando

## 4.3 Configuración del Frontend Móvil

### 4.3.1 Estructura del Proyecto Móvil
```
mobile/
├── src/
│   ├── components/          # Componentes reutilizables
│   ├── contexts/            # Context API (Auth, Validation)
│   ├── screens/             # Pantallas de la aplicación
│   ├── services/            # Servicios de API
│   └── utils/               # Utilidades
├── assets/                  # Imágenes y recursos
├── App.js                   # Componente principal
├── app.json                 # Configuración Expo
├── package.json             # Dependencias Node
└── babel.config.js          # Configuración Babel
```

### 4.3.2 Instalación de Dependencias del Frontend
```bash
cd mobile
npm install
```
- ✅ Todas las dependencias instaladas:
  - React Native y React
  - Expo SDK
  - React Navigation (Stack, Bottom Tabs)
  - React Native Paper
  - Axios
  - AsyncStorage
  - Expo SecureStore
  - Expo Barcode Scanner
  - Expo Camera
  - React Native Signature Canvas
  - Expo SQLite
  - Y otras dependencias necesarias

### 4.3.3 Configuración de Servicios de API
- ✅ Servicios configurados:
  - `AuthService.js` - Autenticación
  - `JigService.js` - Gestión de jigs
  - `JigNGService.js` - Gestión de jigs NG
  - `ValidationService.js` - Validaciones
  - `ReportService.js` - Reportes
  - `AdminService.js` - Administración
  - `OfflineService.js` - Funcionalidad offline
- ✅ URLs de API configuradas
- ✅ Interceptores de Axios configurados para tokens JWT

### 4.3.4 Configuración de Navegación
- ✅ React Navigation configurado
- ✅ Navegación por stacks implementada
- ✅ Navegación por tabs implementada
- ✅ Navegación condicional (Auth/App) configurada

### 4.3.5 Configuración de Context API
- ✅ `AuthContext` - Gestión de autenticación global
- ✅ `ValidationContext` - Gestión de validaciones

## 4.4 Configuración de ngrok (Túnel de Desarrollo)

### 4.4.1 Instalación de ngrok
- ✅ ngrok instalado
- ✅ Cuenta configurada

### 4.4.2 Configuración del Túnel
```bash
ngrok http 8000
```
- ✅ Túnel configurado para puerto 8000 (backend)
- ✅ URL pública generada
- ✅ Scripts de actualización automática de URLs implementados

### 4.4.3 Scripts de Automatización
- ✅ `start_all.ps1` - Script PowerShell para iniciar todo el sistema
- ✅ `start_app.bat` - Script batch alternativo
- ✅ Actualización automática de URLs en servicios móviles

## 4.5 Configuración de Base de Datos Local (Móvil)

### 4.5.1 Expo SQLite
- ✅ Base de datos SQLite local configurada
- ✅ Tablas creadas para modo offline:
  - Tabla de validaciones pendientes
  - Tabla de jigs en caché
- ✅ Sincronización offline implementada

## 4.6 Pantallas Implementadas y Configuradas

### 4.6.1 Pantallas de Autenticación
- ✅ `LoginScreen` - Pantalla de inicio de sesión
- ✅ `RegisterScreen` - Pantalla de registro
- ✅ `SolicitudStatusScreen` - Estado de solicitudes

### 4.6.2 Pantallas Principales
- ✅ `HomeScreen` - Dashboard principal
- ✅ `ProfileScreen` - Perfil de usuario y firma digital
- ✅ `AllJigsScreen` - Lista de todos los jigs

### 4.6.3 Pantallas de Gestión de Jigs
- ✅ `QRScannerScreen` - Escáner de códigos QR
- ✅ `AddJigScreen` - Agregar nuevo jig
- ✅ `JigDetailScreen` - Detalles de jig
- ✅ `ValidationScreen` - Proceso de validación

### 4.6.4 Pantallas de Jigs NG
- ✅ `JigNGScreen` - Lista de jigs NG
- ✅ `AddJigNGScreen` - Reportar jig NG
- ✅ `JigNGDetailScreen` - Detalles y seguimiento

### 4.6.5 Otras Pantallas
- ✅ `ReporteScreen` - Generación de reportes
- ✅ `RepairJigScreen` - Gestión de reparaciones
- ✅ `AdminScreen` - Panel de administración
- ✅ `AdminSolicitudesScreen` - Gestión de solicitudes

## 4.7 Funcionalidades Implementadas

### 4.7.1 Autenticación
- ✅ Login con usuario y contraseña
- ✅ Registro de nuevos usuarios
- ✅ Almacenamiento seguro de tokens JWT
- ✅ Manejo de sesiones expiradas
- ✅ Logout funcional

### 4.7.2 Gestión de Jigs
- ✅ Escaneo de códigos QR
- ✅ Registro de nuevos jigs
- ✅ Visualización de lista de jigs
- ✅ Filtros y búsqueda
- ✅ Detalles de jig individual

### 4.7.3 Validaciones
- ✅ Proceso de validación completo
- ✅ Captura de firma digital
- ✅ Registro de observaciones
- ✅ Generación de reportes PDF

### 4.7.4 Jigs NG
- ✅ Reporte de jigs con problemas
- ✅ Seguimiento de estados de reparación
- ✅ Comentarios y actualizaciones
- ✅ Dashboard de estadísticas

### 4.7.5 Reportes
- ✅ Generación de reportes PDF
- ✅ Inclusión de firmas digitales
- ✅ Descarga y compartir reportes

### 4.7.6 Modo Offline
- ✅ Almacenamiento local de validaciones
- ✅ Sincronización cuando hay conexión
- ✅ Indicador de estado de conexión

## 4.8 Pruebas y Verificación

### 4.8.1 Pruebas del Backend
- ✅ Servidor inicia correctamente
- ✅ Endpoints responden correctamente
- ✅ Autenticación JWT funciona
- ✅ Base de datos se crea y actualiza correctamente
- ✅ Generación de PDFs funciona

### 4.8.2 Pruebas del Frontend
- ✅ Aplicación se ejecuta en Expo
- ✅ Navegación entre pantallas funciona
- ✅ Conexión con backend establecida
- ✅ Escaneo de QR funciona
- ✅ Captura de firma funciona
- ✅ Generación de reportes funciona

### 4.8.3 Pruebas de Integración
- ✅ Flujo completo de validación probado
- ✅ Flujo de jigs NG probado
- ✅ Sincronización offline probada

## 4.9 Documentación Creada

- ✅ `README.md` - Documentación principal del proyecto
- ✅ `INSTALACION.md` - Guía detallada de instalación
- ✅ `SISTEMA_REGISTRO_README.md` - Documentación del sistema de registro
- ✅ `SISTEMA_PERFIL_COMPLETO_README.md` - Documentación del sistema de perfil
- ✅ `JIGS_NG_README.md` - Documentación de jigs NG
- ✅ Comentarios en código
- ✅ Documentación de API (Swagger/OpenAPI)

## 4.10 Scripts de Automatización Creados

- ✅ `start_all.ps1` - Inicia backend, ngrok y frontend
- ✅ `start_app.bat` - Script alternativo de inicio
- ✅ `restart_expo.bat` - Reinicia Expo
- ✅ `update_ngrok.bat` - Actualiza URL de ngrok
- ✅ `update_ngrok_url.py` - Script Python para actualizar URLs
- ✅ `update_dependencies.bat` - Actualiza dependencias móviles

---

<div style="page-break-after: always;"></div>

# 5. ESTRUCTURA DEL PROYECTO

## 5.1 Organización de Carpetas

```
APP Movil/
├── backend/                 # Backend Python/FastAPI
│   ├── app/
│   │   ├── models/         # Modelos de base de datos
│   │   ├── routers/       # Endpoints de la API
│   │   ├── services/      # Lógica de negocio
│   │   └── utils/         # Utilidades
│   ├── main.py
│   ├── run.py
│   └── requirements.txt
│
├── mobile/                  # Frontend React Native/Expo
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── contexts/      # Context API
│   │   ├── screens/       # Pantallas
│   │   ├── services/      # Servicios de API
│   │   └── utils/         # Utilidades
│   ├── App.js
│   └── package.json
│
├── documentacion/          # Documentación del proyecto
│   └── AVANCE_SEMANAL_1.md
│
├── README.md               # Documentación principal
├── INSTALACION.md          # Guía de instalación
└── start_all.ps1           # Script de inicio
```

## 5.2 Archivos Clave

### Backend
- `backend/main.py` - Punto de entrada de la aplicación
- `backend/run.py` - Script de ejecución del servidor
- `backend/app/models/models.py` - Modelos de base de datos
- `backend/app/routers/` - Todos los endpoints de la API

### Frontend
- `mobile/App.js` - Componente raíz de la aplicación
- `mobile/src/screens/` - Todas las pantallas
- `mobile/src/services/` - Servicios de comunicación con API
- `mobile/src/contexts/` - Contextos globales de React

---

<div style="page-break-after: always;"></div>

# 6. ENLACE AL REPOSITORIO DE GITHUB

## 6.1 Información del Repositorio

**URL del Repositorio:**  
https://github.com/alexandroreynosocesun/AppMovil-Cesun---Instrumentation

**Nombre del Repositorio:**  
`AppMovil-Cesun---Instrumentation`

**Propietario:**  
alexandroreynosocesun

**Visibilidad:**  
Público/Privado (según configuración)

## 6.2 Estructura en GitHub

El repositorio contiene:

- ✅ Código fuente completo del backend (Python/FastAPI)
- ✅ Código fuente completo del frontend (React Native/Expo)
- ✅ Documentación del proyecto
- ✅ Scripts de automatización
- ✅ Archivos de configuración
- ✅ Guías de instalación
- ✅ README con información del proyecto

## 6.3 Comandos para Clonar el Repositorio

```bash
git clone https://github.com/alexandroreynosocesun/AppMovil-Cesun---Instrumentation.git
cd AppMovil-Cesun---Instrumentation
```

## 6.4 Historial de Commits

El repositorio mantiene un historial completo de commits con:
- Commits descriptivos de cada funcionalidad implementada
- Mensajes de commit claros y organizados
- Branch principal (main) con código estable

---

<div style="page-break-after: always;"></div>

# 7. CONCLUSIONES Y PRÓXIMOS PASOS

## 7.1 Logros Alcanzados

Durante este primer avance semanal se ha logrado:

1. ✅ **Configuración completa del entorno de desarrollo**
   - Backend Python/FastAPI configurado y funcionando
   - Frontend React Native/Expo configurado y funcionando
   - Base de datos SQLite inicializada

2. ✅ **Implementación de funcionalidades core**
   - Sistema de autenticación completo
   - Gestión de jigs con escaneo QR
   - Sistema de validaciones con firmas digitales
   - Gestión de jigs NG
   - Generación de reportes PDF

3. ✅ **Infraestructura de desarrollo**
   - Scripts de automatización creados
   - Configuración de ngrok para desarrollo
   - Documentación completa del proyecto

4. ✅ **Pantallas implementadas**
   - 19 pantallas completamente funcionales
   - Navegación fluida entre pantallas
   - UI/UX profesional con React Native Paper

## 7.2 Desafíos Encontrados

Durante el desarrollo se encontraron algunos desafíos:

1. **Configuración de ngrok**: Requiere actualización manual de URLs en múltiples archivos
   - **Solución**: Scripts de automatización para actualizar URLs

2. **Validación de firmas digitales**: Asegurar que las firmas sean válidas y no corruptas
   - **Solución**: Implementación de validaciones robustas de formato y tamaño

3. **Sincronización offline**: Manejar datos cuando no hay conexión
   - **Solución**: Implementación de SQLite local y servicio de sincronización

## 7.3 Próximos Pasos

Para el siguiente avance se planea:

1. **Mejoras en la UI/UX**
   - Refinamiento de diseños
   - Mejora de animaciones y transiciones
   - Optimización de rendimiento

2. **Funcionalidades Adicionales**
   - Notificaciones push
   - Mejoras en el modo offline
   - Analytics y reportes avanzados

3. **Testing**
   - Pruebas unitarias
   - Pruebas de integración
   - Pruebas de usuario

4. **Optimización**
   - Optimización de consultas a base de datos
   - Mejora de rendimiento de la app
   - Reducción del tamaño de la aplicación

5. **Documentación**
   - Manual de usuario
   - Guía de despliegue
   - Documentación técnica avanzada

---

# 8. ANEXOS

## 8.1 Comandos Útiles

### Backend
```bash
# Activar entorno virtual
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor
python run.py
```

### Frontend
```bash
# Instalar dependencias
npm install

# Ejecutar aplicación
npx expo start
```

### Git
```bash
# Agregar cambios
git add .

# Hacer commit
git commit -m "Mensaje descriptivo"

# Subir cambios
git push
```

## 8.2 Recursos Adicionales

- Documentación de React Native: https://reactnative.dev/
- Documentación de Expo: https://docs.expo.dev/
- Documentación de FastAPI: https://fastapi.tiangolo.com/
- Documentación de React Navigation: https://reactnavigation.org/

---

**FIN DEL DOCUMENTO**

---

*Este documento representa el primer avance semanal del proyecto "Sistema de Validación de Jigs - Aplicación Móvil", desarrollado para la asignatura de Desarrollo de Aplicaciones Móviles / Instrumentación en CESUN.*

*Fecha de creación: Noviembre 2025*

