from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional, List

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
    
    class Config:
        from_attributes = True

# Esquemas para Validaciones
class ValidacionBase(BaseModel):
    jig_id: int
    turno: str
    estado: str
    comentario: Optional[str] = None
    cantidad: int = 1

class ValidacionCreate(ValidacionBase):
    firma_digital: Optional[str] = None

class Validacion(ValidacionBase):
    id: int
    tecnico_id: int
    fecha: datetime
    sincronizado: bool
    created_at: datetime
    
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
