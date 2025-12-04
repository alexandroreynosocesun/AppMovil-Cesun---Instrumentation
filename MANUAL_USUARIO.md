# 📱 Manual de Usuario
## Sistema de Validación de Jigs - Aplicación Móvil

**Versión:** 1.0.0  
**Fecha:** Diciembre 2025

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Requisitos del Sistema](#requisitos-del-sistema)
3. [Instalación](#instalación)
4. [Primeros Pasos](#primeros-pasos)
5. [Pantalla Principal (Home)](#pantalla-principal-home)
6. [Escaneo de Códigos QR](#escaneo-de-códigos-qr)
7. [Validación de Jigs](#validación-de-jigs)
8. [Generación de Reportes](#generación-de-reportes)
9. [Gestión de Jigs NG](#gestión-de-jigs-ng)
10. [Sistema de Auditoría](#sistema-de-auditoría)
11. [Gestión de Perfil](#gestión-de-perfil)
12. [Administración](#administración)
13. [Solución de Problemas](#solución-de-problemas)
14. [Preguntas Frecuentes (FAQ)](#preguntas-frecuentes-faq)

---

## 🎯 Introducción

Bienvenido al **Sistema de Validación de Jigs**, una aplicación móvil diseñada para facilitar la gestión, validación y seguimiento de jigs industriales. Esta aplicación permite a los técnicos e ingenieros realizar validaciones digitales, generar reportes automáticos y mantener un control completo sobre el estado de los equipos de producción.

### ¿Qué es un Jig?

Un jig es una herramienta de producción utilizada para mantener y guiar una pieza de trabajo durante la fabricación. En este sistema, cada jig tiene un código QR único que permite identificarlo rápidamente.

### Funcionalidades Principales

- ✅ **Escaneo QR** - Identificación rápida de jigs mediante códigos QR
- ✅ **Validación Digital** - Registro de validaciones con firma electrónica
- ✅ **Generación de Reportes PDF** - Reportes profesionales automáticos
- ✅ **Gestión de Jigs NG** - Reporte y seguimiento de jigs no conformes
- ✅ **Sistema de Auditoría** - Trazabilidad completa de todos los reportes
- ✅ **Gestión de Perfil** - Configuración personal de usuario

### 🎥 Video Demo

Para ver una demostración completa de la aplicación en funcionamiento, puedes acceder al siguiente video:

**📹 [Video Demo - Sistema de Validación de Jigs](https://drive.google.com/file/d/1kJ5Xrlh16WDntigfsKG1Sng5sxTCy6cm/view?usp=sharing)**

Este video muestra:
- Inicio de sesión y navegación
- Escaneo de códigos QR
- Proceso completo de validación
- Generación de reportes PDF
- Gestión de jigs NG
- Sistema de auditoría

---

## 💻 Requisitos del Sistema

### Dispositivos Compatibles

- **Android:** Versión 8.0 (Oreo) o superior
- **iOS:** Versión 13.0 o superior
- **Web:** Navegadores modernos (Chrome, Firefox, Safari, Edge)

### Requisitos Adicionales

- **Conexión a Internet:** Requerida para sincronizar datos con el servidor
- **Cámara:** Necesaria para escanear códigos QR
- **Permisos:** La aplicación solicitará permisos para:
  - Cámara (para escanear QR)
  - Almacenamiento (para guardar reportes PDF)

---

## 📥 Instalación

### Opción 1: Instalación desde APK (Android)

1. Descarga el archivo APK desde el repositorio o enlace proporcionado
2. En tu dispositivo Android, ve a **Configuración > Seguridad**
3. Habilita la opción **"Orígenes desconocidos"** o **"Instalar aplicaciones desconocidas"**
4. Abre el archivo APK descargado
5. Sigue las instrucciones en pantalla para completar la instalación

### Opción 2: Instalación desde Expo Go (Desarrollo)

1. Instala **Expo Go** desde Google Play Store o App Store
2. Abre Expo Go en tu dispositivo
3. Escanea el código QR proporcionado por el desarrollador
4. La aplicación se cargará automáticamente

### Opción 3: Uso en Navegador Web

1. Abre tu navegador web
2. Navega a la URL proporcionada por el administrador
3. La aplicación se cargará automáticamente

---

## 🚀 Primeros Pasos

### 1. Inicio de Sesión

Al abrir la aplicación por primera vez, verás la **Pantalla de Inicio de Sesión**.

#### Pasos para Iniciar Sesión:

1. **Ingresa tu Usuario:**
   - Escribe tu nombre de usuario en el campo "Usuario"
   - Este es el mismo usuario que te proporcionó el administrador

2. **Ingresa tu Contraseña:**
   - Escribe tu contraseña en el campo "Contraseña"
   - La contraseña es sensible a mayúsculas y minúsculas

3. **Presiona "Iniciar Sesión":**
   - Si tus credenciales son correctas, serás redirigido a la pantalla principal
   - Si hay un error, verás un mensaje indicando el problema

#### ¿No tienes una cuenta?

1. Presiona el botón **"Registrarse"** en la pantalla de login
2. Completa el formulario de registro:
   - **Nombre completo**
   - **Número de empleado** (único)
   - **Usuario** (único)
   - **Contraseña** (mínimo 6 caracteres)
   - **Turno** (A, B o C)
   - **Tipo de usuario** (selecciona según tu rol)
3. Presiona **"Registrarse"**
4. Tu solicitud será enviada a un administrador para aprobación
5. Puedes verificar el estado de tu solicitud en la pantalla **"Estado de Solicitud"**

---

## 🏠 Pantalla Principal (Home)

La pantalla principal es el centro de control de la aplicación. Desde aquí puedes acceder a todas las funcionalidades principales.

### Elementos de la Pantalla Principal

#### 1. **Header con Información del Usuario**
- Muestra tu nombre y número de empleado
- Indicador de conexión (verde = conectado, rojo = sin conexión)
- Botón de menú para acceder a tu perfil

#### 2. **Tarjetas de Acceso Rápido**

**🔍 Escanear QR**
- Acceso directo al escáner de códigos QR
- Úsalo para identificar jigs rápidamente

**✅ Validar Jig**
- Inicia el proceso de validación de un jig
- Requiere haber escaneado un código QR primero

**📊 Generar Reporte**
- Accede a la pantalla de generación de reportes
- Genera reportes PDF de validaciones completadas

**❌ Jigs NG**
- Accede a la gestión de jigs no conformes
- Reporta problemas con jigs

**📋 Auditoría**
- Visualiza todos los reportes PDF generados
- Filtra por fecha, turno, línea, etc.

**🔧 Todos los Jigs**
- Lista completa de todos los jigs registrados
- Búsqueda y filtros avanzados

#### 3. **Estadísticas**

La pantalla muestra estadísticas en tiempo real:
- **Validaciones en curso:** Modelos con validaciones parciales
- **Modelos completados:** Modelos con todas las validaciones (14/14)
- **Jigs NG pendientes:** Jigs reportados como no conformes

#### 4. **Navegación**

- **Botón de Perfil:** Accede a tu perfil y configuración
- **Botón de Cerrar Sesión:** Cierra tu sesión de forma segura

---

## 📷 Escaneo de Códigos QR

El escaneo de códigos QR es la forma más rápida de identificar jigs en el sistema.

### Cómo Usar el Escáner QR

#### Paso 1: Acceder al Escáner

1. Desde la pantalla principal, presiona el botón **"Escanear QR"**
2. O desde el menú de navegación, selecciona **"Escanear QR"**

#### Paso 2: Permisos de Cámara

- La primera vez que uses el escáner, la app solicitará permiso para usar la cámara
- Presiona **"Permitir"** para continuar
- Si denegaste el permiso, ve a Configuración de tu dispositivo y habilítalo manualmente

#### Paso 3: Escanear el Código QR

1. **Apunta la cámara** al código QR del jig
2. **Mantén el código dentro del marco** que aparece en pantalla
3. El código se escaneará automáticamente
4. Verás una confirmación visual cuando el código sea leído

#### Paso 4: Resultados del Escaneo

Después de escanear, la aplicación mostrará:

- **Si el jig existe:**
  - Información del jig (número, tipo, modelo, estado)
  - Opciones para:
    - **Validar Jig:** Iniciar proceso de validación
    - **Ver Detalles:** Ver información completa del jig
    - **Reportar como NG:** Marcar el jig como no conforme

- **Si el jig NO existe:**
  - Opción para **"Agregar Jig Manualmente"**
  - Formulario para registrar un nuevo jig en el sistema

### Modo Especial: Escaneo para Jigs NG

Si accedes al escáner desde la sección de Jigs NG, el escáner funcionará en modo especial para reportar jigs no conformes directamente.

---

## ✅ Validación de Jigs

La validación de jigs es el proceso principal de la aplicación. Permite registrar el estado de un jig con todos los detalles necesarios.

### Proceso de Validación

#### Paso 1: Seleccionar el Jig

1. **Escanea el código QR** del jig que deseas validar
2. O busca el jig manualmente desde **"Todos los Jigs"**
3. Presiona **"Validar Jig"** en la información del jig

#### Paso 2: Completar el Formulario de Validación

La pantalla de validación muestra:

**Información del Jig:**
- Número de jig
- Tipo (Manual, Semiautomático, New Semiautomático)
- Modelo actual

**Campos a Completar:**

1. **Estado:**
   - **OK:** El jig está en buen estado
   - **NG:** El jig tiene problemas (No Conforme)

2. **Cantidad:** Número de piezas validadas (por defecto: 1)

3. **Comentario:** Observaciones sobre la validación
   - Ejemplos: "Limpieza realizada", "Ajuste de calibración", etc.

4. **Línea:** Línea de producción donde se realizó la validación
   - Ejemplos: "Línea 1", "Línea 5", etc.

5. **Firma Digital:**
   - Presiona el botón **"Firmar"**
   - Dibuja tu firma en la pantalla táctil
   - Presiona **"Guardar"** para confirmar
   - Presiona **"Limpiar"** si quieres volver a firmar

#### Paso 3: Guardar la Validación

1. Revisa que todos los campos estén completos
2. Presiona el botón **"Guardar Validación"**
3. Verás una confirmación de que la validación fue guardada
4. La validación se agregará a tu lista de validaciones

### Validaciones por Modelo

- Cada modelo requiere **14 validaciones completas** para considerarse validado
- Puedes ver el progreso en la pantalla principal
- Las validaciones se agrupan automáticamente por modelo

---

## 📊 Generación de Reportes

Los reportes PDF se generan automáticamente cuando completas las validaciones de un modelo.

### Cómo Generar un Reporte

#### Paso 1: Completar Validaciones

1. Realiza las **14 validaciones** requeridas para un modelo
2. Puedes verificar el progreso en la pantalla principal
3. Cuando completes las 14 validaciones, el modelo aparecerá como "Completado"

#### Paso 2: Acceder a la Pantalla de Reportes

1. Desde la pantalla principal, presiona **"Generar Reporte"**
2. O desde el menú, selecciona **"Reportes"**

#### Paso 3: Seleccionar Modelo y Configuración

La pantalla de reportes muestra:

**Modelos Disponibles:**
- Lista de modelos con validaciones completadas (14/14)
- Selecciona el modelo para el cual quieres generar el reporte

**Configuración del Reporte:**

1. **Modelo:** Selecciona de la lista de modelos completados
2. **Turno:** Selecciona el turno (A, B o C)
3. **Fecha:** Selecciona la fecha del reporte (por defecto: fecha actual)

**Validaciones Incluidas:**
- La pantalla muestra todas las validaciones que se incluirán en el reporte
- Verifica que todas las validaciones sean correctas

#### Paso 4: Generar el Reporte

1. Presiona el botón **"Generar Reporte PDF"**
2. Espera mientras se genera el PDF (puede tomar unos segundos)
3. Verás una confirmación cuando el reporte esté listo

#### Paso 5: Ver y Compartir el Reporte

Después de generar el reporte:

1. **Vista Previa:** Se mostrará una vista previa del PDF
2. **Descargar:** Presiona "Descargar" para guardar el PDF en tu dispositivo
3. **Compartir:** Presiona "Compartir" para enviar el PDF por email, WhatsApp, etc.
4. **Guardar en Auditoría:** El reporte se guarda automáticamente en el sistema de auditoría

### Contenido del Reporte PDF

El reporte PDF incluye:

- **Encabezado:** Información de la empresa y departamento
- **Información del Reporte:**
  - Modelo
  - Fecha
  - Turno
  - Técnico responsable
  - Línea de producción
  - Total de jigs validados

- **Tabla de Validaciones:**
  - Número de jig
  - Tipo
  - Estado (OK/NG)
  - Turno
  - Comentarios

- **Resumen Estadístico:**
  - Total de jigs validados
  - Cantidad de jigs OK
  - Cantidad de jigs NG
  - Porcentaje de éxito

- **Firma del Técnico:**
  - Nombre del técnico
  - Número de empleado
  - Fecha

---

## ❌ Gestión de Jigs NG

Los Jigs NG (No Conformes) son jigs que tienen problemas y requieren atención.

### Reportar un Jig como NG

#### Paso 1: Acceder a la Sección de Jigs NG

1. Desde la pantalla principal, presiona **"Jigs NG"**
2. O desde el menú, selecciona **"Jigs NG"**

#### Paso 2: Agregar un Jig NG

1. Presiona el botón **"Agregar Jig NG"** o el botón **"+"**
2. Tienes dos opciones:

**Opción A: Escanear QR**
- Presiona **"Escanear QR"**
- Escanea el código QR del jig problemático
- La información del jig se llenará automáticamente

**Opción B: Ingresar Manualmente**
- Completa el formulario:
  - **Modelo:** Modelo del jig
  - **Tipo de Jig:** Manual, Semiautomático, New Semiautomático
  - **Número de Jig:** (Opcional)
  - **Foto:** Toma una foto del problema
  - **Motivo:** Descripción del problema
  - **Categoría:** Tipo de problema
  - **Prioridad:** Baja, Media, Alta, Crítica

#### Paso 3: Tomar Foto del Problema

1. Presiona el botón **"Tomar Foto"**
2. Permite el acceso a la cámara si se solicita
3. Toma una foto clara del problema
4. Presiona **"Usar Foto"** para confirmar
5. O presiona **"Tomar Otra"** si quieres volver a tomar

#### Paso 4: Guardar el Reporte

1. Revisa toda la información
2. Presiona **"Guardar Reporte NG"**
3. El jig será marcado como NG y aparecerá en la lista

### Ver y Gestionar Jigs NG

#### Lista de Jigs NG

La pantalla muestra todos los jigs reportados como NG con:

- **Estado:** Pendiente, En Reparación, Reparado, Falso Defecto
- **Prioridad:** Indicada con colores
- **Fecha de reporte**
- **Técnico que reportó**

#### Acciones Disponibles

1. **Ver Detalles:**
   - Presiona sobre un jig NG para ver información completa
   - Incluye foto, motivo, historial de reparaciones

2. **Actualizar Estado:**
   - Marca el jig como "En Reparación"
   - Marca como "Reparado" cuando se complete la reparación
   - Marca como "Falso Defecto" si no había problema real

3. **Agregar Comentarios:**
   - Agrega comentarios sobre la reparación
   - Incluye información sobre qué se reparó

### Reparar un Jig NG

1. Desde la lista de Jigs NG, selecciona el jig que quieres reparar
2. Presiona **"Reparar Jig"**
3. Completa el formulario:
   - **Estado:** Selecciona "Reparado" o "Falso Defecto"
   - **Comentarios de Reparación:** Describe qué se reparó
4. Presiona **"Guardar Reparación"**
5. El jig volverá a estado "activo" si fue reparado

---

## 📋 Sistema de Auditoría

El sistema de auditoría permite ver todos los reportes PDF generados y realizar búsquedas avanzadas.

### Acceder a la Auditoría

1. Desde la pantalla principal, presiona **"Auditoría"**
2. O desde el menú, selecciona **"Auditoría"**

### Visualizar Reportes

La pantalla de auditoría muestra:

**Lista de Reportes:**
- Nombre del archivo PDF
- Modelo
- Fecha y hora de generación
- Turno
- Técnico responsable
- Línea de producción
- Cantidad de validaciones incluidas

### Filtros Disponibles

Puedes filtrar los reportes por:

1. **Día:** Selecciona un día específico del mes
2. **Mes:** Selecciona un mes específico
3. **Año:** Selecciona un año específico
4. **Turno:** Filtra por Turno A, B o C
5. **Línea:** Filtra por línea de producción

**Cómo Usar los Filtros:**

1. Presiona el botón del filtro que deseas aplicar (ej: "Día")
2. Selecciona el valor del filtro
3. Los reportes se actualizarán automáticamente
4. Para quitar un filtro, presiona "Todos" o "Limpiar Filtros"

### Descargar Reportes

1. En la lista de reportes, presiona sobre el reporte que deseas descargar
2. Presiona el botón **"Descargar"**
3. El PDF se descargará a tu dispositivo
4. También puedes presionar **"Compartir"** para enviarlo por email u otras apps

### Estadísticas

La pantalla de auditoría muestra estadísticas:

- **Total de reportes:** Cantidad total de PDFs generados
- **Reportes por año:** Distribución por año
- **Reportes por mes:** Distribución por mes (del año seleccionado)
- **Reportes por turno:** Distribución por turno

---

## 👤 Gestión de Perfil

Tu perfil contiene tu información personal y configuración de la aplicación.

### Acceder a tu Perfil

1. Desde la pantalla principal, presiona tu **nombre** o el **ícono de usuario**
2. O desde el menú, selecciona **"Perfil"**

### Información del Perfil

La pantalla muestra:

- **Nombre completo**
- **Número de empleado**
- **Usuario**
- **Turno actual**
- **Tipo de usuario** (técnico, ingeniero, admin, etc.)

### Editar Perfil

#### Cambiar Información Personal

1. Presiona el botón **"Editar Perfil"**
2. Modifica los campos que desees:
   - **Nombre:** Tu nombre completo
   - **Número de empleado:** (no se puede cambiar)
   - **Turno actual:** Selecciona A, B o C
3. Presiona **"Guardar"** para confirmar los cambios

#### Cambiar Contraseña

1. En la sección de edición de perfil, completa:
   - **Nueva Contraseña:** Mínimo 6 caracteres
   - **Confirmar Contraseña:** Debe coincidir con la nueva contraseña
2. Presiona **"Guardar"** para actualizar tu contraseña

### Gestión de Firma Digital

Tu firma digital se usa en los reportes PDF generados.

#### Agregar o Actualizar Firma

1. En la pantalla de perfil, presiona **"Gestionar Firma Digital"**
2. Dibuja tu firma en la pantalla táctil
3. Presiona **"Guardar Firma"** para confirmar
4. Presiona **"Limpiar"** si quieres volver a dibujar
5. Presiona **"Cancelar"** para salir sin guardar

### Cerrar Sesión

1. En la pantalla de perfil, presiona el botón **"Cerrar Sesión"**
2. Confirma que deseas cerrar sesión
3. Serás redirigido a la pantalla de inicio de sesión

---

## 🔧 Administración

Las funciones de administración están disponibles solo para usuarios con rol de **administrador** o **ingeniero**.

### Panel de Administración

Accede desde el menú principal si tienes permisos de administrador.

#### Gestión de Usuarios

1. **Ver Todos los Usuarios:**
   - Lista completa de usuarios registrados
   - Información: nombre, número de empleado, tipo de usuario, estado

2. **Editar Usuario:**
   - Presiona sobre un usuario para ver detalles
   - Puedes cambiar:
     - Tipo de usuario
     - Estado (activo/inactivo)
     - Turno

3. **Activar/Desactivar Usuario:**
   - Cambia el estado de un usuario
   - Los usuarios inactivos no pueden iniciar sesión

#### Gestión de Solicitudes de Registro

1. **Ver Solicitudes Pendientes:**
   - Lista de usuarios que solicitaron registro
   - Información de cada solicitud

2. **Aprobar Solicitud:**
   - Revisa la información del solicitante
   - Presiona **"Aprobar"** para permitir el acceso
   - O **"Rechazar"** si no cumple los requisitos

3. **Agregar Comentarios:**
   - Puedes agregar comentarios al aprobar o rechazar
   - El usuario verá estos comentarios en su estado de solicitud

#### Asignación de Validaciones

1. **Asignar Validaciones a Técnicos:**
   - Selecciona un modelo que requiere validación
   - Asigna a un técnico específico
   - El técnico verá la validación asignada en su pantalla

2. **Ver Validaciones Asignadas:**
   - Lista de todas las validaciones asignadas
   - Estado de cada validación (pendiente, completada)

3. **Ver Validaciones Activas:**
   - Validaciones en curso
   - Progreso de cada validación

### Gestión de Almacenamiento (Solo Admin)

1. **Ver Estado del Almacenamiento:**
   - Espacio usado y disponible
   - Cantidad de PDFs almacenados
   - Tamaño total de archivos

2. **Limpieza Manual:**
   - Opción para limpiar PDFs antiguos manualmente
   - Configurar políticas de retención

---

## 🔍 Gestión de Jigs

### Ver Todos los Jigs

1. Desde la pantalla principal, presiona **"Todos los Jigs"**
2. Verás una lista completa de todos los jigs registrados

### Búsqueda y Filtros

#### Búsqueda por Texto

1. Escribe en el campo de búsqueda:
   - Número de jig
   - Código QR
   - Modelo
2. Los resultados se filtrarán automáticamente

#### Filtros por Tipo

1. Presiona el botón de tipo de jig:
   - **Todos:** Muestra todos los jigs
   - **Manual:** Solo jigs manuales
   - **Semiautomático:** Solo jigs semiautomáticos
   - **New Semiautomático:** Solo jigs new semiautomáticos

#### Vista Agrupada

- **Por Tipo:** Agrupa los jigs por tipo
- **Por Modelo:** Agrupa los jigs por modelo actual
- **Lista:** Vista de lista simple

### Agregar un Jig Manualmente

1. Desde la pantalla de "Todos los Jigs", presiona **"Agregar Jig"**
2. O desde el escáner QR, presiona **"Agregar Jig Manualmente"**
3. Completa el formulario:
   - **Código QR:** Código único del jig
   - **Número de Jig:** Número identificador
   - **Tipo:** Manual, Semiautomático, New Semiautomático
   - **Modelo Actual:** Modelo que está validando actualmente
   - **Estado:** Activo, Inactivo, En Reparación
4. Presiona **"Guardar"** para registrar el jig

### Ver Detalles de un Jig

1. Presiona sobre un jig en la lista
2. Verás información completa:
   - Información básica
   - Historial de validaciones
   - Estado actual
   - Última validación

---

## 🏷️ Gestión de Etiquetas Dañadas

Si encuentras una etiqueta QR dañada o ilegible, puedes reportarla.

### Reportar Etiqueta Dañada

1. Desde el menú, selecciona **"Reportar Etiqueta Dañada"**
2. Completa el formulario:
   - **Modelo:** Modelo del jig (si lo conoces)
   - **Tipo de Jig:** Manual, Semiautomático, New Semiautomático
   - **Número de Jig:** (Opcional, si está visible)
   - **Foto:** Toma una foto de la etiqueta dañada
3. Presiona **"Enviar Reporte"**
4. El reporte será registrado para seguimiento

### Ver Etiquetas Reportadas

1. Desde el menú, selecciona **"Etiquetas Dañadas"**
2. Verás una lista de todas las etiquetas reportadas
3. Información mostrada:
   - Modelo
   - Tipo de jig
   - Fecha del reporte
   - Técnico que reportó
   - Foto de la etiqueta

---

## 🔧 Solución de Problemas

### Problemas Comunes y Soluciones

#### 1. No Puedo Iniciar Sesión

**Problema:** El sistema muestra "Usuario o contraseña incorrectos"

**Soluciones:**
- Verifica que estés escribiendo correctamente tu usuario y contraseña
- Asegúrate de que las mayúsculas y minúsculas sean correctas
- Verifica que tu solicitud de registro haya sido aprobada
- Contacta al administrador si el problema persiste

#### 2. El Escáner QR No Funciona

**Problema:** La cámara no se activa o no escanea códigos

**Soluciones:**
- Verifica que hayas dado permiso para usar la cámara
- Ve a Configuración de tu dispositivo > Aplicaciones > Validación de Jigs > Permisos
- Habilita el permiso de cámara
- Asegúrate de que el código QR esté bien iluminado
- Mantén el código dentro del marco de escaneo
- Limpia la lente de la cámara

#### 3. Error al Generar Reporte

**Problema:** El sistema muestra un error al intentar generar un reporte

**Soluciones:**
- Verifica que tengas conexión a Internet
- Asegúrate de que el modelo tenga las 14 validaciones completas
- Verifica que todos los campos requeridos estén completos
- Intenta nuevamente después de unos segundos
- Si el problema persiste, contacta al administrador

#### 4. No Aparecen Mis Validaciones

**Problema:** Las validaciones que hice no aparecen en la lista

**Soluciones:**
- Verifica tu conexión a Internet
- Presiona el botón de "Actualizar" o desliza hacia abajo para refrescar
- Asegúrate de haber guardado la validación correctamente
- Verifica que estés buscando en el modelo correcto

#### 5. El PDF No Se Descarga

**Problema:** No puedo descargar o compartir el PDF

**Soluciones:**
- Verifica que tengas espacio de almacenamiento disponible
- Asegúrate de tener permisos de almacenamiento habilitados
- Intenta descargar nuevamente
- Si usas Android, verifica que la app tenga permisos de almacenamiento

#### 6. La Aplicación Se Cierra Inesperadamente

**Problema:** La app se cierra sin razón aparente

**Soluciones:**
- Cierra completamente la aplicación y vuelve a abrirla
- Reinicia tu dispositivo
- Verifica que tengas la última versión de la aplicación
- Libera espacio de almacenamiento si tu dispositivo está lleno
- Si el problema persiste, contacta al soporte técnico

#### 7. No Veo Mis Reportes en Auditoría

**Problema:** Los reportes que generé no aparecen en auditoría

**Soluciones:**
- Verifica que el reporte se haya generado correctamente
- Revisa los filtros aplicados (pueden estar ocultando tus reportes)
- Presiona "Limpiar Filtros" para ver todos los reportes
- Verifica la fecha del reporte que estás buscando
- Contacta al administrador si el problema persiste

#### 8. No Puedo Firmar Digitalmente

**Problema:** La pantalla de firma no responde o no guarda

**Soluciones:**
- Asegúrate de estar dibujando en el área de firma
- Presiona "Guardar" después de dibujar tu firma
- Si la pantalla no responde, presiona "Limpiar" y vuelve a intentar
- Reinicia la aplicación si el problema persiste

---

## ❓ Preguntas Frecuentes (FAQ)

### Preguntas Generales

**P: ¿Necesito conexión a Internet para usar la aplicación?**  
R: Sí, la aplicación requiere conexión a Internet para sincronizar datos con el servidor. Sin embargo, algunas funciones básicas pueden funcionar en modo offline temporal.

**P: ¿Puedo usar la aplicación en múltiples dispositivos?**  
R: Sí, puedes iniciar sesión desde cualquier dispositivo. Tus datos se sincronizan con el servidor.

**P: ¿Qué hago si olvidé mi contraseña?**  
R: Contacta al administrador del sistema para que restablezca tu contraseña.

**P: ¿Cuántas validaciones necesito hacer por modelo?**  
R: Cada modelo requiere exactamente 14 validaciones para considerarse completo.

**P: ¿Puedo editar una validación después de guardarla?**  
R: No, las validaciones no se pueden editar después de guardarse. Si cometiste un error, contacta al administrador.

### Preguntas sobre Validaciones

**P: ¿Qué significa "Estado OK" y "Estado NG"?**  
R: 
- **OK:** El jig está en buen estado y funcionando correctamente
- **NG (No Conforme):** El jig tiene problemas y requiere atención

**P: ¿Puedo validar el mismo jig múltiples veces?**  
R: Sí, puedes validar el mismo jig múltiples veces. Cada validación se registra por separado.

**P: ¿Qué pasa si no completo las 14 validaciones de un modelo?**  
R: El modelo aparecerá como "En Progreso" hasta que completes las 14 validaciones. Solo los modelos completos pueden generar reportes.

### Preguntas sobre Reportes

**P: ¿Cuánto tiempo tarda en generarse un reporte PDF?**  
R: Generalmente toma entre 5 y 15 segundos, dependiendo de la cantidad de validaciones y la velocidad de tu conexión.

**P: ¿Dónde se guardan los PDFs descargados?**  
R: Los PDFs se guardan en la carpeta de descargas de tu dispositivo. Puedes acceder a ellos desde cualquier aplicación de archivos.

**P: ¿Puedo compartir un reporte por WhatsApp o Email?**  
R: Sí, después de generar un reporte, puedes usar el botón "Compartir" para enviarlo por cualquier aplicación instalada en tu dispositivo.

**P: ¿Los reportes se guardan automáticamente?**  
R: Sí, todos los reportes se guardan automáticamente en el sistema de auditoría, incluso si no los descargas.

### Preguntas sobre Jigs NG

**P: ¿Qué debo hacer si encuentro un jig con problemas?**  
R: Reporta el jig como NG desde la sección "Jigs NG", incluyendo una foto del problema y una descripción detallada.

**P: ¿Puedo reparar un jig NG yo mismo?**  
R: Depende de tu rol y permisos. Si tienes permisos, puedes marcar el jig como "Reparado" después de realizar la reparación.

**P: ¿Qué significa "Falso Defecto"?**  
R: Significa que el jig fue reportado como NG pero después de revisar, se determinó que no tenía problemas reales.

### Preguntas sobre Permisos y Roles

**P: ¿Qué diferencias hay entre los roles de usuario?**  
R:
- **Técnico:** Puede validar jigs y generar reportes
- **Ingeniero:** Puede validar, generar reportes y asignar validaciones
- **Admin:** Acceso completo a todas las funciones
- **Inventario:** Puede gestionar jigs y reportar problemas

**P: ¿Puedo cambiar mi tipo de usuario?**  
R: No, solo un administrador puede cambiar tu tipo de usuario. Contacta al administrador si necesitas un cambio.

### Preguntas Técnicas

**P: ¿La aplicación funciona sin conexión a Internet?**  
R: Funcionalidades básicas pueden funcionar temporalmente, pero necesitas conexión para:
- Sincronizar validaciones
- Generar reportes
- Ver datos actualizados
- Guardar cambios

**P: ¿Qué versión de Android/iOS necesito?**  
R: 
- Android: Versión 8.0 (Oreo) o superior
- iOS: Versión 13.0 o superior

**P: ¿La aplicación consume mucha batería?**  
R: El uso normal de la aplicación consume batería de forma moderada. El uso intensivo de la cámara (escáner QR) puede consumir más batería.

---

## 📞 Soporte y Contacto

### ¿Necesitas Ayuda?

Si encuentras problemas o tienes preguntas que no están cubiertas en este manual:

1. **Contacta al Administrador del Sistema**
   - El administrador puede ayudarte con problemas de acceso, permisos y configuración

2. **Revisa los Logs de la Aplicación**
   - Si hay un error, los mensajes de error pueden ayudar a identificar el problema

3. **Reporta Problemas Técnicos**
   - Si encuentras un bug o error, reporta el problema con:
     - Descripción del problema
     - Pasos para reproducirlo
     - Capturas de pantalla (si es posible)
     - Información de tu dispositivo (modelo, versión del sistema operativo)

### Información del Sistema

- **Versión de la Aplicación:** 1.0.0
- **Última Actualización:** Diciembre 2025
- **Soporte:** Contacta al equipo de desarrollo

---

## 📝 Glosario de Términos

- **Jig:** Herramienta de producción utilizada para mantener y guiar piezas durante la fabricación
- **Validación:** Proceso de verificar y registrar el estado de un jig
- **NG (No Conforme):** Jig que tiene problemas y requiere atención
- **QR (Quick Response):** Código de barras bidimensional que almacena información
- **PDF (Portable Document Format):** Formato de documento que preserva el formato original
- **Turno:** Período de trabajo (A: 6:30 AM - 6:30 PM, B: 6:30 PM - 6:30 AM)
- **Línea:** Línea de producción donde se realiza el trabajo
- **Auditoría:** Sistema de registro y seguimiento de todos los reportes generados
- **Firma Digital:** Firma electrónica dibujada en la pantalla táctil

---

## 🔄 Actualizaciones y Mejoras

Este manual se actualiza periódicamente. Si encuentras información desactualizada o tienes sugerencias para mejorar el manual, contacta al equipo de desarrollo.

**Última actualización del manual:** Diciembre 2025

---

## ✅ Checklist de Uso Diario

### Al Iniciar tu Turno

- [ ] Iniciar sesión en la aplicación
- [ ] Verificar conexión a Internet
- [ ] Revisar validaciones asignadas (si aplica)
- [ ] Revisar jigs NG pendientes (si aplica)

### Durante tu Turno

- [ ] Escanear códigos QR de jigs a validar
- [ ] Completar validaciones con todos los datos requeridos
- [ ] Agregar firma digital a cada validación
- [ ] Reportar jigs NG si encuentras problemas
- [ ] Tomar fotos claras de problemas

### Al Finalizar tu Turno

- [ ] Generar reportes de modelos completados
- [ ] Verificar que los reportes se hayan guardado en auditoría
- [ ] Actualizar estado de jigs NG si realizaste reparaciones
- [ ] Cerrar sesión de forma segura

---

## 🎓 Consejos y Mejores Prácticas

### Para Validaciones Precisas

1. **Toma tu tiempo:** Asegúrate de verificar bien el estado del jig antes de validar
2. **Comentarios claros:** Escribe comentarios descriptivos que ayuden a entender el estado del jig
3. **Firma legible:** Asegúrate de que tu firma digital sea clara y legible
4. **Fotos de calidad:** Si reportas un jig NG, toma fotos claras y bien iluminadas

### Para Reportes Profesionales

1. **Revisa antes de generar:** Verifica que todas las validaciones sean correctas antes de generar el reporte
2. **Completa las 14 validaciones:** Asegúrate de tener todas las validaciones antes de generar
3. **Verifica la información:** Revisa que el modelo, turno y fecha sean correctos

### Para Uso Eficiente

1. **Usa el escáner QR:** Es más rápido que buscar manualmente
2. **Mantén la app actualizada:** Las actualizaciones incluyen mejoras y correcciones
3. **Guarda frecuentemente:** No dejes validaciones sin guardar
4. **Revisa tu conexión:** Asegúrate de tener buena señal antes de generar reportes importantes

---

## 📱 Atajos y Accesos Rápidos

### Desde la Pantalla Principal

- **Escanear QR:** Acceso directo al escáner
- **Validar Jig:** Inicia validación del último jig escaneado
- **Generar Reporte:** Acceso rápido a generación de reportes
- **Jigs NG:** Acceso directo a gestión de jigs no conformes

### Gestos y Navegación

- **Deslizar hacia abajo:** Actualizar lista de elementos
- **Tocar y mantener:** Acciones rápidas en algunos elementos
- **Botón Atrás:** Volver a la pantalla anterior

---

## 🔒 Seguridad y Privacidad

### Protección de Datos

- **Contraseñas:** Nunca compartas tu contraseña con nadie
- **Cerrar Sesión:** Siempre cierra sesión cuando termines de usar la app
- **Dispositivos Compartidos:** Si usas un dispositivo compartido, asegúrate de cerrar sesión

### Buenas Prácticas

- **Actualiza tu contraseña:** Cambia tu contraseña periódicamente
- **No compartas acceso:** Cada usuario debe tener su propia cuenta
- **Reporta problemas:** Si notas actividad sospechosa, contacta al administrador

---

## 📚 Recursos Adicionales

### Documentación Técnica

- **README del Proyecto:** Información técnica sobre la aplicación
- **Documentación de API:** Para desarrolladores que integren con el sistema

### Capacitación

- **Video Demo Completo:** [Ver Video Demo](https://drive.google.com/file/d/1kJ5Xrlh16WDntigfsKG1Sng5sxTCy6cm/view?usp=sharing)
  - Este video muestra todas las funcionalidades principales de la aplicación
  - Incluye demostraciones paso a paso de cada proceso
- **Sesiones de Entrenamiento:** Contacta al administrador para capacitación presencial o virtual

---

## 📄 Anexos

### Anexo A: Códigos de Error Comunes

| Código | Descripción | Solución |
|--------|-------------|----------|
| 400 | Datos inválidos | Verifica que todos los campos estén completos correctamente |
| 401 | No autorizado | Tu sesión expiró, inicia sesión nuevamente |
| 404 | No encontrado | El recurso que buscas no existe |
| 500 | Error del servidor | Contacta al administrador |

### Anexo B: Formatos de Fecha y Hora

- **Formato de Fecha:** DD/MM/YYYY (Ejemplo: 04/12/2025)
- **Formato de Hora:** HH:MM (24 horas, Ejemplo: 21:04)
- **Zona Horaria:** UTC (Tiempo Universal Coordinado)

### Anexo C: Límites del Sistema

- **Validaciones por modelo:** 14 (requeridas para generar reporte)
- **Tamaño máximo de foto:** 10 MB
- **Longitud de comentarios:** Hasta 500 caracteres
- **Tiempo de sesión:** 24 horas (después debes iniciar sesión nuevamente)

---

**Fin del Manual de Usuario**

*Este manual fue creado para ayudarte a usar eficientemente el Sistema de Validación de Jigs. Si tienes preguntas o sugerencias, no dudes en contactar al equipo de soporte.*

**Versión del Manual:** 1.0.0  
**Fecha:** Diciembre 2025

