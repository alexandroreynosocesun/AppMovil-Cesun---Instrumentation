# Sistema de Registro de Usuarios con Firma Digital

## Descripción

Se ha implementado un sistema completo de registro de usuarios que incluye:

- **Formulario de registro** con todos los datos necesarios
- **Captura de firma digital** en pantalla
- **Sistema de aprobación** por administradores
- **Integración de firma** en los PDFs de validación

## Instalación

### 1. Instalar Dependencia de Firma Digital

```bash
cd mobile
npm install react-native-signature-capture
```

### 2. Configuración para Android

Agregar en `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### 3. Actualizar Base de Datos

```bash
cd backend
python update_database.py
```

## Funcionalidades

### Para Usuarios Nuevos

1. **Pantalla de Registro:**
   - Formulario completo con validaciones
   - Captura de firma digital en pantalla
   - Envío de solicitud al administrador

2. **Datos Requeridos:**
   - Usuario (único)
   - Nombre completo
   - Contraseña (mínimo 6 caracteres)
   - PIN (4 dígitos)
   - Firma digital

3. **Flujo de Registro:**
   - Usuario completa formulario
   - Crea su firma digital
   - Envía solicitud
   - Espera aprobación del administrador

### Para Administradores

1. **Gestión de Solicitudes:**
   - Ver todas las solicitudes pendientes
   - Aprobar o rechazar solicitudes
   - Agregar comentarios
   - Ver estadísticas

2. **Proceso de Aprobación:**
   - Revisar datos del usuario
   - Verificar firma digital
   - Aprobar o rechazar
   - El usuario recibe notificación

## API Endpoints

### Registro de Usuarios
- `POST /api/auth/register` - Crear solicitud de registro
- `GET /api/registro/` - Listar solicitudes (admin)
- `GET /api/registro/{id}` - Ver solicitud específica (admin)
- `PUT /api/registro/{id}` - Aprobar/rechazar solicitud (admin)
- `DELETE /api/registro/{id}` - Eliminar solicitud (admin)

## Base de Datos

### Nueva Tabla: `solicitudes_registro`

```sql
CREATE TABLE solicitudes_registro (
    id INTEGER PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin VARCHAR(4),
    firma_digital TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente',
    admin_id INTEGER,
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta DATETIME,
    comentarios_admin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Estados de Solicitud

- **pendiente** - Esperando aprobación del administrador
- **aprobada** - Usuario creado exitosamente
- **rechazada** - Solicitud rechazada por el administrador

## Integración con PDFs

La firma digital capturada se almacena en base64 y se integra automáticamente en:

- Reportes de validación individual
- Reportes de validación por lotes
- Reportes de turno
- Todos los PDFs generados por el usuario

## Seguridad

- **Contraseñas encriptadas** con bcrypt
- **Validación de datos** en frontend y backend
- **Verificación de unicidad** de usuarios
- **Solo administradores** pueden aprobar solicitudes
- **Firmas digitales** almacenadas de forma segura

## Flujo Completo

1. **Usuario nuevo** accede a la app
2. **Toca "Crear Nueva Cuenta"** en login
3. **Completa formulario** con sus datos
4. **Crea firma digital** en pantalla
5. **Envía solicitud** al administrador
6. **Administrador revisa** la solicitud
7. **Administrador aprueba/rechaza** la solicitud
8. **Usuario recibe notificación** del resultado
9. **Si es aprobada**, el usuario puede iniciar sesión
10. **Su firma se usa** en todos sus reportes

## Beneficios

- **Control total** sobre quién accede al sistema
- **Firmas digitales** para trazabilidad completa
- **Proceso de aprobación** para mantener seguridad
- **Integración automática** de firmas en reportes
- **Experiencia de usuario** intuitiva y profesional

## Notas Técnicas

- La firma se captura como imagen PNG en base64
- Se valida que no existan usuarios duplicados
- Las solicitudes pendientes bloquean nuevos registros
- Los administradores pueden ver todas las solicitudes
- El sistema mantiene historial completo de aprobaciones
