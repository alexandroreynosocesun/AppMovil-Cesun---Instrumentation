from pydantic import BaseModel, validator, field_serializer
from datetime import datetime, timezone
from typing import Optional, List, Generic, TypeVar, Any

# Tipo genérico para paginación
T = TypeVar('T')

# Esquema genérico para respuestas paginadas
class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int
    
    class Config:
        from_attributes = True

# Esquemas para Técnicos
class TecnicoBase(BaseModel):
    usuario: str
    nombre: str
    numero_empleado: str

class TecnicoCreate(TecnicoBase):
    password: str

class TecnicoLogin(BaseModel):
    usuario: str
    password: str

class TecnicoUpdate(BaseModel):
    nombre: Optional[str] = None
    numero_empleado: Optional[str] = None
    password: Optional[str] = None
    firma_digital: Optional[str] = None
    turno_actual: Optional[str] = None
    tipo_usuario: Optional[str] = None
    
    @validator('turno_actual')
    def validate_turno_actual(cls, v):
        if v is not None and v not in ['A', 'B', 'C', 'mañana', 'noche', 'fines']:
            raise ValueError('El turno debe ser A, B, C, mañana, noche o fines')
        return v

class Tecnico(TecnicoBase):
    id: int
    firma_digital: Optional[str] = None
    turno_actual: str
    tipo_tecnico: str
    tipo_usuario: str
    activo: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Esquemas para Jigs
class JigBase(BaseModel):
    codigo_qr: str
    numero_jig: str
    tipo: str
    modelo_actual: Optional[str] = None

class JigCreate(JigBase):
    pass

class Jig(JigBase):
    id: int
    estado: str
    created_at: datetime
    fecha_ultima_validacion: Optional[datetime] = None
    tecnico_ultima_validacion_id: Optional[int] = None
    turno_ultima_validacion: Optional[str] = None
    tecnico_ultima_validacion: Any = None

    @field_serializer('tecnico_ultima_validacion')
    def serialize_tecnico(self, tecnico, _info):
        """Serializar el técnico de última validación"""
        if tecnico is None:
            return None
        # Si ya es un diccionario, devolverlo tal cual
        if isinstance(tecnico, dict):
            return tecnico
        # Si es un objeto Tecnico de SQLAlchemy, convertirlo a diccionario
        return {
            'id': tecnico.id,
            'nombre': tecnico.nombre,
            'numero_empleado': tecnico.numero_empleado,
            'usuario': tecnico.usuario
        }

    class Config:
        from_attributes = True

# Esquemas para Validaciones
class ValidacionBase(BaseModel):
    jig_id: Optional[int] = None  # Opcional para asignaciones sin jig específico
    modelo_actual: Optional[str] = None  # Modelo del jig si está disponible
    turno: str
    estado: str
    comentario: Optional[str] = None
    cantidad: int = 1

class ValidacionCreate(ValidacionBase):
    firma_digital: Optional[str] = None
    tecnico_asignado_id: Optional[int] = None  # Para asignaciones
    modelo_actual: Optional[str] = None  # Modelo del jig
    fecha: Optional[str] = None  # Fecha en formato ISO string (UTC) desde el cliente

class Validacion(ValidacionBase):
    id: int
    tecnico_id: int
    tecnico_asignado_id: Optional[int] = None
    fecha: datetime
    sincronizado: bool
    completada: bool = False
    created_at: datetime
    
    @field_serializer('fecha', 'created_at')
    def serialize_datetime(self, value: datetime, _info):
        """Serializar datetime asegurándose de que tenga timezone UTC"""
        if value is None:
            return None
        # Si la fecha no tiene timezone (naive), asumir que es UTC
        if value.tzinfo is None:
            # Crear nueva fecha con timezone UTC explícito
            value = value.replace(tzinfo=timezone.utc)
        else:
            # Si ya tiene timezone, convertir a UTC
            value = value.astimezone(timezone.utc)
        # Retornar en formato ISO con Z al final (asegurar formato UTC)
        iso_str = value.isoformat()
        # Reemplazar +00:00 o -00:00 con Z para claridad
        if iso_str.endswith('+00:00') or iso_str.endswith('-00:00'):
            iso_str = iso_str[:-6] + 'Z'
        elif not iso_str.endswith('Z'):
            iso_str = iso_str + 'Z'
        return iso_str
    
    class Config:
        from_attributes = True

# Esquemas para Reparaciones
class ReparacionBase(BaseModel):
    jig_id: int
    descripcion: str
    estado_anterior: str
    estado_nuevo: str

class ReparacionCreate(ReparacionBase):
    pass

class Reparacion(ReparacionBase):
    id: int
    tecnico_id: int
    fecha: datetime
    sincronizado: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Esquema para respuesta de login
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    tecnico: Tecnico

# Esquemas para Jigs NG
class JigNGBase(BaseModel):
    jig_id: int
    motivo: str
    categoria: str = "Falla técnica"  # Categoría fija
    prioridad: str = "media"
    usuario_reporte: Optional[str] = None
    usuario_reparando: Optional[str] = None
    comentario_reparacion: Optional[str] = None
    foto: Optional[str] = None  # Base64 de la foto del jig NG

class JigNGCreate(JigNGBase):
    pass

class JigNGUpdate(BaseModel):
    estado: Optional[str] = None
    observaciones_reparacion: Optional[str] = None
    usuario_reparando: Optional[str] = None
    comentario_reparacion: Optional[str] = None

class JigNG(JigNGBase):
    id: int
    tecnico_id: int
    fecha_ng: datetime
    estado: str
    fecha_reparacion: Optional[datetime] = None
    tecnico_reparacion_id: Optional[int] = None
    observaciones_reparacion: Optional[str] = None
    sincronizado: bool
    created_at: datetime
    
    # Información del técnico que reportó
    tecnico_ng: Optional[dict] = None
    # Información del técnico que reparó
    tecnico_reparacion: Optional[dict] = None
    # Información del jig relacionado
    jig: Optional[dict] = None
    
    class Config:
        from_attributes = True

# Esquemas para Solicitudes de Registro
class SolicitudRegistroBase(BaseModel):
    usuario: str
    nombre: str
    numero_empleado: str
    password: str
    tipo_usuario: str = "tecnico"  # ingeniero, tecnico, gestion
    turno_actual: str = "A"
    firma_digital: Optional[str] = None

class SolicitudRegistroCreate(SolicitudRegistroBase):
    pass

class SolicitudRegistroResponse(BaseModel):
    id: int
    usuario: str
    nombre: str
    estado: str
    fecha_solicitud: datetime
    fecha_respuesta: Optional[datetime] = None
    comentarios_admin: Optional[str] = None
    
    class Config:
        from_attributes = True

class SolicitudRegistroUpdate(BaseModel):
    estado: str
    comentarios_admin: Optional[str] = None

# Esquema para historial de jig
class JigHistorial(BaseModel):
    jig: Jig
    validaciones: List[Validacion]
    reparaciones: List[Reparacion]
    jigs_ng: List[JigNG] = []

# Esquemas para Etiquetas NG Dañadas
class DamagedLabelBase(BaseModel):
    modelo: str
    tipo_jig: str  # manual, semiautomatico, new_semiautomatico
    numero_jig: Optional[str] = None
    foto: Optional[str] = None  # Base64 de la foto

class DamagedLabelCreate(DamagedLabelBase):
    pass

class DamagedLabelUpdate(BaseModel):
    estado: Optional[str] = None

class DamagedLabel(DamagedLabelBase):
    id: int
    reportado_por_id: int
    estado: str
    created_at: datetime
    
    # Información del usuario que reportó
    reportado_por: Optional[dict] = None
    
    class Config:
        from_attributes = True

# Esquemas para Auditoría PDF
class AuditoriaPDFBase(BaseModel):
    nombre_archivo: str
    ruta_archivo: str
    modelo: Optional[str] = None
    tecnico_nombre: str
    numero_empleado: str
    fecha: datetime
    turno: str
    linea: Optional[str] = None
    cantidad_validaciones: int = 0

class AuditoriaPDFCreate(AuditoriaPDFBase):
    tecnico_id: int

class AuditoriaPDF(AuditoriaPDFBase):
    id: int
    tecnico_id: int
    fecha_dia: int
    fecha_mes: int
    fecha_anio: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Esquemas para Adaptadores
class AdaptadorBase(BaseModel):
    codigo_qr: str
    numero_adaptador: str
    modelo_adaptador: str

class AdaptadorCreate(AdaptadorBase):
    conectores: Optional[List[str]] = None  # Lista de nombres de conectores

class AdaptadorUpdate(BaseModel):
    numero_adaptador: Optional[str] = None
    modelo_adaptador: Optional[str] = None
    estado: Optional[str] = None

class Adaptador(AdaptadorBase):
    id: int
    estado: str
    created_at: datetime
    conectores: Optional[List[dict]] = None
    
    class Config:
        from_attributes = True

# Esquemas para Conectores
class ConectorAdaptadorBase(BaseModel):
    nombre_conector: str
    estado: str = "OK"

class ConectorAdaptador(ConectorAdaptadorBase):
    id: int
    adaptador_id: int
    fecha_estado_ng: Optional[datetime] = None
    tecnico_ng_id: Optional[int] = None
    usuario_reporte_ng: Optional[str] = None
    comentario_ng: Optional[str] = None
    fecha_ultima_validacion: Optional[datetime] = None
    tecnico_ultima_validacion_id: Optional[int] = None
    linea_ultima_validacion: Optional[str] = None
    turno_ultima_validacion: Optional[str] = None
    created_at: datetime
    tecnico_ng: Optional[dict] = None
    
    class Config:
        from_attributes = True

class ConectorAdaptadorUpdate(BaseModel):
    estado: str  # OK, NG
    comentario: Optional[str] = None

class ConectorUsoBulkUpdate(BaseModel):
    conector_ids: List[int]
    fecha_ok: Optional[datetime] = None
    linea: Optional[str] = None
    turno: Optional[str] = None

# Esquemas para Validaciones de Adaptadores
class ValidacionConectorBase(BaseModel):
    conector_id: int
    estado: str  # OK, NG
    comentario: Optional[str] = None

class ValidacionAdaptadorBase(BaseModel):
    adaptador_id: int
    turno: str
    estado_general: str
    comentario: Optional[str] = None
    conectores: List[ValidacionConectorBase]  # Lista de validaciones por conector

class ValidacionAdaptadorCreate(ValidacionAdaptadorBase):
    pass

class ValidacionConector(ValidacionConectorBase):
    id: int
    validacion_adaptador_id: int
    conector: Optional[dict] = None
    
    class Config:
        from_attributes = True

class ValidacionAdaptador(ValidacionAdaptadorBase):
    id: int
    tecnico_id: int
    fecha: datetime
    created_at: datetime
    adaptador: Optional[dict] = None
    tecnico: Optional[dict] = None
    detalle_conectores: Optional[List[ValidacionConector]] = None
    
    class Config:
        from_attributes = True

# Esquemas para Secuencias Arduino
class ArduinoSequenceBase(BaseModel):
    comando: str
    destino: str
    pais: Optional[str] = None
    modelo: str
    modelo_interno: str

class ArduinoSequenceCreate(ArduinoSequenceBase):
    pass

class ArduinoSequenceUpdate(BaseModel):
    comando: Optional[str] = None
    destino: Optional[str] = None
    pais: Optional[str] = None
    modelo: Optional[str] = None
    modelo_interno: Optional[str] = None

class ArduinoSequence(ArduinoSequenceBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
