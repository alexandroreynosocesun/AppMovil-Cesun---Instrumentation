# 📱 Sistema de Validación de Jigs - Aplicación Móvil

## 🎯 **Propuesta del Proyecto**

### **Objetivo Principal**
Desarrollar una aplicación móvil integral para la gestión, validación y seguimiento de jigs industriales, proporcionando una solución completa para el control de calidad y mantenimiento de equipos de producción.

### **Problema a Resolver**
- **Falta de trazabilidad** en el proceso de validación de jigs
- **Gestión manual** de reportes y documentación
- **Dificultad para rastrear** el estado de reparaciones
- **Proceso de validación** poco eficiente y propenso a errores
- **Falta de integración** entre diferentes áreas de producción

### **Solución Propuesta**
Una aplicación móvil que centraliza toda la gestión de jigs, desde su registro inicial hasta la generación de reportes finales, incluyendo:

- **Escaneo QR** para identificación rápida
- **Validaciones digitales** con firmas electrónicas
- **Seguimiento en tiempo real** del estado de jigs
- **Reportes automáticos** en formato PDF
- **Gestión de jigs NG** (No Conformes) con seguimiento completo

---

## 🛠️ **Tecnologías Utilizadas**

### **Frontend - Aplicación Móvil**
- **React Native** - Framework principal para desarrollo móvil multiplataforma
- **React Navigation** - Navegación entre pantallas
- **React Native Paper** - Librería de componentes UI/UX
- **Expo** - Plataforma de desarrollo y despliegue
- **AsyncStorage** - Almacenamiento local de datos
- **Expo SecureStore** - Almacenamiento seguro de credenciales

### **Backend - API REST**
- **Python** - Lenguaje de programación principal
- **FastAPI** - Framework web moderno y rápido
- **SQLAlchemy** - ORM para manejo de base de datos
- **SQLite** - Base de datos relacional
- **Pydantic** - Validación de datos y serialización
- **JWT** - Autenticación basada en tokens

### **Generación de Documentos**
- **ReportLab** - Generación de PDFs
- **Base64** - Codificación de imágenes (firmas)

### **Desarrollo y Despliegue**
- **Git** - Control de versiones
- **ngrok** - Túnel para desarrollo local
- **Figma** - Diseño de interfaces de usuario

---

## 📱 **Pantallas Implementadas**

### **🔐 Autenticación**
1. **LoginScreen** - Inicio de sesión de usuarios
2. **RegisterScreen** - Registro de nuevos usuarios
3. **SolicitudStatusScreen** - Estado de solicitudes de registro

### **🏠 Pantallas Principales**
4. **HomeScreen** - Dashboard principal
5. **ProfileScreen** - Perfil de usuario y gestión de firma digital
6. **SignatureScreen** - Captura de firma digital

### **🔧 Gestión de Jigs**
7. **QRScannerScreen** - Escáner de códigos QR para identificación
8. **AllJigsScreen** - Vista completa de jigs con filtros avanzados
9. **AddJigScreen** - Registro de nuevos jigs
10. **JigDetailScreen** - Detalles específicos de cada jig
11. **ValidationScreen** - Proceso de validación de jigs

### **❌ Jigs NG (No Conformes)**
12. **JigNGScreen** - Gestión de jigs con problemas
13. **AddJigNGScreen** - Reporte de jigs NG
14. **JigNGDetailScreen** - Detalles y seguimiento de reparaciones

### **📊 Reportes y Documentación**
15. **ReporteScreen** - Generación de reportes PDF
16. **ValidationDetailScreen** - Detalles de validaciones

### **🔧 Reparaciones**
17. **RepairJigScreen** - Gestión de reparaciones

### **👥 Administración**
18. **AdminScreen** - Panel de administración
19. **AdminSolicitudesScreen** - Gestión de solicitudes de registro

---

## 🚀 **Funcionalidades Principales**

### **1. Gestión de Jigs**
- ✅ Registro de jigs con código QR único
- ✅ Clasificación por tipo (Manual, Semiautomático, New Semiautomático)
- ✅ Seguimiento de modelo actual
- ✅ Estado de activo/inactivo

### **2. Sistema de Validaciones**
- ✅ Validación digital con firma electrónica
- ✅ Captura de datos técnicos
- ✅ Registro de observaciones
- ✅ Generación automática de reportes

### **3. Jigs NG (No Conformes)**
- ✅ Reporte de problemas
- ✅ Asignación de responsables de reparación
- ✅ Seguimiento de estados (Pendiente, En Reparación, Reparado, Falso Defecto)
- ✅ Comentarios de reparación
- ✅ Dashboard de estadísticas

### **4. Generación de Reportes**
- ✅ Reportes PDF profesionales
- ✅ Inclusión de firmas digitales
- ✅ Datos completos de validación
- ✅ Descarga y compartir

### **5. Sistema de Usuarios**
- ✅ Autenticación segura con JWT
- ✅ Roles de usuario
- ✅ Gestión de perfiles
- ✅ Solicitudes de registro

---

## 📊 **Características Técnicas**

### **Arquitectura**
- **Frontend:** React Native con Expo
- **Backend:** FastAPI con SQLAlchemy
- **Base de Datos:** SQLite
- **Autenticación:** JWT tokens
- **Comunicación:** REST API

### **Seguridad**
- ✅ Autenticación JWT
- ✅ Almacenamiento seguro de credenciales
- ✅ Validación de datos en frontend y backend
- ✅ Manejo seguro de firmas digitales

### **UX/UI**
- ✅ Diseño profesional con tema oscuro
- ✅ Navegación intuitiva
- ✅ Componentes reutilizables
- ✅ Feedback visual para acciones
- ✅ Manejo de errores user-friendly

---

## 🎨 **Diseño de Interfaz**

### **Herramientas de Diseño**
- **Figma** - Mockups y prototipos
- **React Native Paper** - Componentes Material Design
- **Tema oscuro profesional** - Consistencia visual

### **Principios de Diseño**
- ✅ **Usabilidad** - Interfaz intuitiva
- ✅ **Consistencia** - Patrones de diseño uniformes
- ✅ **Accesibilidad** - Fácil navegación
- ✅ **Responsive** - Adaptable a diferentes dispositivos

---

## 📈 **Beneficios del Proyecto**

### **Para la Empresa**
- **Trazabilidad completa** de todos los jigs
- **Reducción de errores** en validaciones
- **Automatización** de reportes
- **Control de calidad** mejorado
- **Historial completo** de mantenimientos

### **Para los Usuarios**
- **Interfaz intuitiva** y fácil de usar
- **Acceso móvil** desde cualquier lugar
- **Proceso simplificado** de validación
- **Reportes automáticos** sin trabajo manual

### **Para el Proceso**
- **Eficiencia mejorada** en validaciones
- **Documentación automática**
- **Seguimiento en tiempo real**
- **Integración completa** del flujo de trabajo

---

## 🔮 **Futuras Mejoras**

- **Notificaciones push** para actualizaciones importantes
- **Sincronización offline** para trabajo sin conexión
- **Analytics avanzados** y reportes de tendencias
- **Integración con sistemas ERP** existentes
- **Módulo de inventario** completo
- **API para integraciones** externas

---

## 👥 **Equipo de Desarrollo**

**Desarrollador Full Stack**
- Frontend: React Native, Expo
- Backend: Python, FastAPI
- Base de Datos: SQLAlchemy, SQLite
- UI/UX: Figma, React Native Paper

---

## 📞 **Contacto**

Para más información sobre este proyecto o consultas técnicas, contactar al equipo de desarrollo.

---

*Este proyecto representa una solución integral para la gestión moderna de jigs industriales, combinando las mejores prácticas de desarrollo móvil con un diseño centrado en el usuario.*