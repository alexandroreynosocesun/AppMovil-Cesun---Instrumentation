from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Tecnico(Base):
    __tablename__ = "tecnicos"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String(50), unique=True, index=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    numero_empleado = Column(String(20), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    firma_digital = Column(Text, nullable=True)  # Base64 de la imagen de firma
    turno_actual = Column(String(20), default="A")  # A(Día), B(Noche), C(Fines)
    tipo_tecnico = Column(String(50), default="Técnico de Instrumentación")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Jig(Base):
    __tablename__ = "jigs"
    
    id = Column(Integer, primary_key=True, index=True)
    codigo_qr = Column(String(50), unique=True, index=True, nullable=False)
    numero_jig = Column(String(20), nullable=False)
    tipo = Column(String(20), nullable=False)  # manual, semiautomatico
    modelo_actual = Column(String(100), nullable=True)
    estado = Column(String(20), default="activo")  # activo, inactivo, reparacion
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    validaciones = relationship("Validacion", back_populates="jig")
    reparaciones = relationship("Reparacion", back_populates="jig")
    jigs_ng = relationship("JigNG", back_populates="jig")

class Validacion(Base):
    __tablename__ = "validaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    jig_id = Column(Integer, ForeignKey("jigs.id"), nullable=False)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow)
    turno = Column(String(20), nullable=False)  # A, B, C
    estado = Column(String(10), nullable=False)  # OK, NG
    comentario = Column(Text, nullable=True)
    cantidad = Column(Integer, default=1)
    firma_digital = Column(Text, nullable=True)
    sincronizado = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    jig = relationship("Jig", back_populates="validaciones")
    tecnico = relationship("Tecnico")

class Reparacion(Base):
    __tablename__ = "reparaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    jig_id = Column(Integer, ForeignKey("jigs.id"), nullable=False)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow)
    descripcion = Column(Text, nullable=False)
    estado_anterior = Column(String(20), nullable=False)
    estado_nuevo = Column(String(20), nullable=False)
    sincronizado = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    jig = relationship("Jig", back_populates="reparaciones")
    tecnico = relationship("Tecnico")

class JigNG(Base):
    __tablename__ = "jigs_ng"
    
    id = Column(Integer, primary_key=True, index=True)
    jig_id = Column(Integer, ForeignKey("jigs.id"), nullable=False)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    fecha_ng = Column(DateTime, default=datetime.utcnow)
    motivo = Column(Text, nullable=False)  # Descripción del problema
    categoria = Column(String(50), default="Falla técnica")  # Categoría fija por defecto
    prioridad = Column(String(20), default="media")  # baja, media, alta, crítica
    estado = Column(String(20), default="pendiente")  # pendiente, en_reparacion, reparado, descartado
    fecha_reparacion = Column(DateTime, nullable=True)
    tecnico_reparacion_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    observaciones_reparacion = Column(Text, nullable=True)
    usuario_reporte = Column(String(100), nullable=True)  # Usuario que reportó el problema
    usuario_reparando = Column(String(100), nullable=True)  # Usuario que está reparando
    comentario_reparacion = Column(Text, nullable=True)  # Comentarios de reparación
    sincronizado = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    jig = relationship("Jig", back_populates="jigs_ng", overlaps="jigs_ng")
    tecnico_ng = relationship("Tecnico", foreign_keys=[tecnico_id])
    tecnico_reparacion = relationship("Tecnico", foreign_keys=[tecnico_reparacion_id])

class SolicitudRegistro(Base):
    __tablename__ = "solicitudes_registro"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String(50), unique=True, index=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    numero_empleado = Column(String(20), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    firma_digital = Column(Text, nullable=True)  # Base64 de la firma
    estado = Column(String(20), default="pendiente")  # pendiente, aprobada, rechazada
    admin_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    fecha_solicitud = Column(DateTime, default=datetime.utcnow)
    fecha_respuesta = Column(DateTime, nullable=True)
    comentarios_admin = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    admin = relationship("Tecnico")