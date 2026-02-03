from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

# Importar Base desde database.py para mantener consistencia
from app.database import Base

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
    tipo_usuario = Column(String(20), default="tecnico")  # ingeniero, tecnico, inventario
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

    # Campos de última validación
    fecha_ultima_validacion = Column(DateTime, nullable=True)
    tecnico_ultima_validacion_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    turno_ultima_validacion = Column(String(20), nullable=True)  # A, B, C

    # Relaciones
    validaciones = relationship("Validacion", back_populates="jig")
    reparaciones = relationship("Reparacion", back_populates="jig")
    jigs_ng = relationship("JigNG", back_populates="jig")
    tecnico_ultima_validacion = relationship("Tecnico", foreign_keys=[tecnico_ultima_validacion_id])

class Validacion(Base):
    __tablename__ = "validaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    jig_id = Column(Integer, ForeignKey("jigs.id"), nullable=True)  # Opcional para asignaciones sin jig específico
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    tecnico_asignado_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)  # Técnico al que se asignó la validación
    fecha = Column(DateTime, default=datetime.utcnow)
    turno = Column(String(20), nullable=False)  # A, B, C
    estado = Column(String(10), nullable=False)  # OK, NG
    comentario = Column(Text, nullable=True)
    cantidad = Column(Integer, default=1)
    firma_digital = Column(Text, nullable=True)
    sincronizado = Column(Boolean, default=False)
    completada = Column(Boolean, default=False)  # Estado de completado de la asignación
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    jig = relationship("Jig", back_populates="validaciones")
    tecnico = relationship("Tecnico", foreign_keys=[tecnico_id])
    tecnico_asignado = relationship("Tecnico", foreign_keys=[tecnico_asignado_id])

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
    foto = Column(Text, nullable=True)  # Base64 de la foto del jig NG
    sincronizado = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    jig = relationship("Jig", back_populates="jigs_ng", overlaps="jigs_ng")
    tecnico_ng = relationship("Tecnico", foreign_keys=[tecnico_id])
    tecnico_reparacion = relationship("Tecnico", foreign_keys=[tecnico_reparacion_id])

class DamagedLabel(Base):
    __tablename__ = "damaged_labels"
    
    id = Column(Integer, primary_key=True, index=True)
    modelo = Column(String(100), nullable=False)  # Modelo del jig
    tipo_jig = Column(String(30), nullable=False)  # manual, semiautomatico, new_semiautomatico
    numero_jig = Column(String(20), nullable=True)  # Opcional, algunos no tienen
    foto = Column(Text, nullable=True)  # Base64 de la foto del jig
    reportado_por_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    estado = Column(String(20), default="pendiente")  # pendiente, procesado, resuelto
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    reportado_por = relationship("Tecnico")

class SolicitudRegistro(Base):
    __tablename__ = "solicitudes_registro"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String(50), unique=True, index=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    numero_empleado = Column(String(20), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    tipo_usuario = Column(String(20), default="tecnico")  # ingeniero, tecnico, gestion
    turno_actual = Column(String(20), default="A")  # A, B, C
    firma_digital = Column(Text, nullable=True)  # Base64 de la firma
    estado = Column(String(20), default="pendiente")  # pendiente, aprobada, rechazada
    admin_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    fecha_solicitud = Column(DateTime, default=datetime.utcnow)
    fecha_respuesta = Column(DateTime, nullable=True)
    comentarios_admin = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    admin = relationship("Tecnico")

class AuditoriaPDF(Base):
    __tablename__ = "auditoria_pdfs"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre_archivo = Column(String(255), nullable=False)
    ruta_archivo = Column(String(500), nullable=False)
    modelo = Column(String(100), nullable=True)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    tecnico_nombre = Column(String(100), nullable=False)
    numero_empleado = Column(String(20), nullable=False)
    fecha = Column(DateTime, nullable=False)
    fecha_dia = Column(Integer, nullable=False)  # Día del mes (1-31)
    fecha_mes = Column(Integer, nullable=False)  # Mes (1-12)
    fecha_anio = Column(Integer, nullable=False)  # Año (2024, 2025, etc.)
    turno = Column(String(20), nullable=False)  # A, B, C
    linea = Column(String(50), nullable=True)
    cantidad_validaciones = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    tecnico = relationship("Tecnico")

class Adaptador(Base):
    __tablename__ = "adaptadores"

    id = Column(Integer, primary_key=True, index=True)
    codigo_qr = Column(String(50), unique=True, index=True, nullable=False)
    numero_adaptador = Column(String(50), nullable=False)
    modelo_adaptador = Column(String(100), nullable=False)
    estado = Column(String(20), default="activo")  # activo, inactivo, baja
    es_dual_conector = Column(Boolean, default=False)  # True si soporta 51+41 pines (VByOne)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    conectores = relationship("ConectorAdaptador", back_populates="adaptador", cascade="all, delete-orphan")
    validaciones = relationship("ValidacionAdaptador", back_populates="adaptador", cascade="all, delete-orphan")

class ConectorAdaptador(Base):
    __tablename__ = "conectores_adaptador"
    
    id = Column(Integer, primary_key=True, index=True)
    adaptador_id = Column(Integer, ForeignKey("adaptadores.id"), nullable=False)
    nombre_conector = Column(String(100), nullable=False)  # ZH-MINI-HD-2, etc.
    estado = Column(String(10), nullable=False, default="OK")  # OK, NG
    fecha_estado_ng = Column(DateTime, nullable=True)  # Cuándo se marcó como NG
    tecnico_ng_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)  # Quién lo marcó como NG
    usuario_reporte_ng = Column(String(100), nullable=True)  # Backup: nombre de usuario
    comentario_ng = Column(Text, nullable=True)  # Comentario cuando se marcó como NG
    fecha_ultima_validacion = Column(DateTime, nullable=True)
    tecnico_ultima_validacion_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=True)
    linea_ultima_validacion = Column(String(50), nullable=True)
    turno_ultima_validacion = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    adaptador = relationship("Adaptador", back_populates="conectores")
    tecnico_ng = relationship("Tecnico", foreign_keys=[tecnico_ng_id], overlaps="tecnico_ultima_validacion")
    tecnico_ultima_validacion = relationship("Tecnico", foreign_keys=[tecnico_ultima_validacion_id], overlaps="tecnico_ng")

class ValidacionAdaptador(Base):
    __tablename__ = "validaciones_adaptador"
    
    id = Column(Integer, primary_key=True, index=True)
    adaptador_id = Column(Integer, ForeignKey("adaptadores.id"), nullable=False)
    tecnico_id = Column(Integer, ForeignKey("tecnicos.id"), nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow)
    turno = Column(String(20), nullable=False)  # A, B, C
    estado_general = Column(String(10), nullable=False)  # OK, NG
    comentario = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    adaptador = relationship("Adaptador", back_populates="validaciones")
    tecnico = relationship("Tecnico")
    detalle_conectores = relationship("ValidacionConector", back_populates="validacion", cascade="all, delete-orphan")

class ValidacionConector(Base):
    __tablename__ = "validaciones_conector"
    
    id = Column(Integer, primary_key=True, index=True)
    validacion_adaptador_id = Column(Integer, ForeignKey("validaciones_adaptador.id"), nullable=False)
    conector_id = Column(Integer, ForeignKey("conectores_adaptador.id"), nullable=False)
    estado = Column(String(10), nullable=False)  # OK, NG
    comentario = Column(Text, nullable=True)
    
    # Relaciones
    validacion = relationship("ValidacionAdaptador", back_populates="detalle_conectores")
    conector = relationship("ConectorAdaptador")

class ModeloMainboardConector(Base):
    __tablename__ = "modelos_mainboard_conector"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre_conector = Column(String(100), nullable=False, index=True)  # ZH-MINI-HD-2, etc.
    modelo_mainboard = Column(String(100), nullable=False)  # 10939, 11493, etc.
    modelo_interno = Column(String(100), nullable=True)  # 50A53FUR, 65C350U, etc.
    tool_sw = Column(String(100), nullable=True)  # mini 08, SKD, 4K VB1, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('nombre_conector', 'modelo_mainboard', name='uq_conector_modelo'),
    )

class ArduinoSequence(Base):
    __tablename__ = "arduino_sequences"
    
    id = Column(Integer, primary_key=True, index=True)
    comando = Column(String(50), nullable=False)
    destino = Column(String(150), nullable=False)
    pais = Column(String(50), nullable=True, index=True)  # COL, MEX, GUA, US (puede ser lista)
    modelo = Column(String(50), nullable=False, index=True)
    modelo_interno = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)