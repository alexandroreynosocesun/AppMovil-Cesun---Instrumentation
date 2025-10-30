# Funcionalidad de Jigs NG (No Good)

## Descripción

Se ha agregado una nueva funcionalidad al sistema para gestionar jigs NG (No Good) que permite:

- **Registrar jigs NG** con motivo del problema, categoría y prioridad
- **Validar jigs NG** antes de permitir su validación normal
- **Gestionar el ciclo de vida** de jigs NG (pendiente → en reparación → reparado/descartado)
- **Mostrar advertencias** cuando se intente validar un jig marcado como NG

## Nuevas Características

### Backend

#### Nuevo Modelo: JigNG
```python
class JigNG(Base):
    __tablename__ = "jigs_ng"
    
    id = Column(Integer, primary_key=True, index=True)
    jig_id = Column(Integer, ForeignKey("jigs.id"), nullable=False)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    fecha_ng = Column(DateTime, default=datetime.utcnow)
    motivo = Column(Text, nullable=False)  # Descripción del problema
    categoria = Column(String(50), nullable=False)  # mecánico, eléctrico, desgaste, etc.
    prioridad = Column(String(20), default="media")  # baja, media, alta, crítica
    estado = Column(String(20), default="pendiente")  # pendiente, en_reparacion, reparado, descartado
    fecha_reparacion = Column(DateTime, nullable=True)
    tecnico_reparacion_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    observaciones_reparacion = Column(Text, nullable=True)
    sincronizado = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### Nuevos Endpoints
- `GET /api/jigs-ng/` - Listar jigs NG con filtros
- `POST /api/jigs-ng/` - Crear nuevo jig NG
- `GET /api/jigs-ng/{id}` - Obtener jig NG por ID
- `PUT /api/jigs-ng/{id}` - Actualizar jig NG
- `DELETE /api/jigs-ng/{id}` - Eliminar jig NG
- `GET /api/jigs-ng/stats/summary` - Estadísticas de jigs NG

#### Validación Mejorada
- El endpoint de validación ahora verifica si un jig está marcado como NG
- Si se detecta un jig NG activo, se bloquea la validación y se muestra información del problema

### Frontend (App Móvil)

#### Nuevas Pantallas

1. **JigNGScreen** - Lista de jigs NG con filtros y estadísticas
2. **AddJigNGScreen** - Formulario para registrar nuevo jig NG
3. **JigNGDetailScreen** - Detalles y gestión de jig NG específico

#### Nuevos Servicios

1. **JigNGService** - Servicio para comunicación con API de jigs NG
   - `createJigNG()` - Crear jig NG
   - `getJigsNG()` - Obtener lista con filtros
   - `updateJigNG()` - Actualizar estado
   - `checkJigNGStatus()` - Verificar si jig tiene NG activo

#### Flujo de Validación Mejorado

1. Al escanear un QR, se verifica automáticamente si el jig tiene NG activo
2. Si se detecta NG, se muestra advertencia con opciones:
   - Ver detalles del problema NG
   - Marcar como reparado
   - Cancelar validación
3. Solo se permite validar jigs sin NG activo

## Instalación y Configuración

### 1. Actualizar Base de Datos

```bash
cd backend
python update_database.py
```

### 2. Reiniciar Backend

```bash
cd backend
python main.py
```

### 3. Actualizar App Móvil

```bash
cd mobile
npm install
npx expo start
```

## Uso de la Funcionalidad

### Para Técnicos

1. **Registrar Jig NG:**
   - Ir a "Escanear Jig NG" desde el menú principal
   - Escanear QR del jig problemático
   - Completar formulario con descripción de la falla y prioridad

2. **Gestionar Jigs NG:**
   - Ir a "Ver Jigs NG" para ver lista con filtros por estado
   - Opción "Falso Defecto" para jigs que no tenían falla real
   - Marcar como reparado directamente desde la lista o detalles
   - Agregar observaciones de qué se reparó
   - Al marcar como reparado, regresa automáticamente a la validación del jig

3. **Validar Jigs:**
   - Al escanear un QR, si el jig tiene NG activo se mostrará advertencia
   - Opción "Ver Detalles NG" para gestionar el jig NG (falso defecto, reparado, observaciones)
   - Opción "Cancelar" para regresar al scanner

### Para Administradores

1. **Ver Estadísticas:**
   - Dashboard con contadores de jigs NG por estado
   - Filtros para análisis detallado

2. **Gestionar Ciclo de Vida:**
   - Cambiar estados de jigs NG
   - Agregar observaciones de reparación
   - Descartar jigs irreparables

## Descripción de Fallas

El sistema permite describir libremente las fallas del jig, con sugerencias intuitivas como:

- **Micrófono** - Problemas con el micrófono
- **5V** - Problemas de alimentación
- **Pines WiFi** - Conexiones WiFi dañadas
- **No prende** - El jig no enciende
- **AV** - Problemas de audio/video
- **Conexión USB** - Problemas de conectividad USB
- **Botones** - Botones no funcionan
- **Pantalla** - Problemas de visualización
- **Carga** - Problemas de batería/carga
- **Sensores** - Sensores defectuosos
- **Calibración** - Problemas de precisión
- **Estructura física** - Daños físicos
- **Cables** - Cables dañados
- **Placa base** - Problemas en la placa principal

## Prioridades

- **Baja** - No afecta producción inmediata
- **Media** - Afecta eficiencia pero no detiene producción
- **Alta** - Afecta producción, requiere atención rápida
- **Crítica** - Detiene producción, requiere atención inmediata

## Estados del Ciclo de Vida

1. **Pendiente** - Jig reportado como NG, esperando reparación
2. **En Reparación** - Jig siendo reparado por técnico
3. **Reparado** - Jig reparado y listo para validación
4. **Descartado** - Jig irreparable, fuera de servicio

## Beneficios

- **Trazabilidad completa** del estado de jigs problemáticos
- **Prevención de validaciones** de jigs con problemas conocidos
- **Gestión eficiente** del ciclo de reparación
- **Estadísticas detalladas** para análisis de calidad
- **Integración transparente** con el flujo de validación existente

## Notas Técnicas

- Los jigs NG se sincronizan automáticamente con el servidor
- El sistema funciona offline y sincroniza cuando hay conexión
- Los cambios de estado se registran con timestamps y técnico responsable
- La validación de jigs NG es obligatoria antes de permitir validaciones normales
