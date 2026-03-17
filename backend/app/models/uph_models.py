from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database_uph import UphBase


class Operador(UphBase):
    __tablename__ = "operadores"

    num_empleado = Column(String, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    foto_url = Column(String, nullable=True)
    turno = Column(String, nullable=True)   # A, B, C
    activo = Column(Boolean, default=True)

    asignaciones = relationship("Asignacion", back_populates="operador")


class Linea(UphBase):
    __tablename__ = "lineas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, unique=True)  # L1-L6

    asignaciones = relationship("Asignacion", back_populates="linea")
    modelos = relationship("ModeloUPH", back_populates="linea")


class ModeloUPH(UphBase):
    __tablename__ = "modelos_uph"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)           # modelo comercial ej. 43A45NV
    num_placa = Column(String, nullable=True)          # número de placa PCB
    modelo_interno = Column(String, nullable=True)     # modelo interno
    uph_total = Column(Float, nullable=False)          # meta UPH por línea
    linea_id = Column(Integer, ForeignKey("lineas.id"), nullable=True)

    linea = relationship("Linea", back_populates="modelos")
    asignaciones = relationship("Asignacion", back_populates="modelo")


class Turno(UphBase):
    __tablename__ = "turnos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)       # A, B, C
    dias = Column(JSON, nullable=False)           # ["lunes","martes","miercoles","jueves"]
    hora_inicio = Column(String, nullable=False)  # "06:30"
    hora_fin = Column(String, nullable=False)     # "18:30"

    asignaciones = relationship("Asignacion", back_populates="turno")


class Asignacion(UphBase):
    __tablename__ = "asignaciones"

    id = Column(Integer, primary_key=True, index=True)
    num_empleado = Column(String, ForeignKey("operadores.num_empleado"), nullable=False)
    estacion = Column(String, nullable=False)     # ej. "604"
    linea_id = Column(Integer, ForeignKey("lineas.id"), nullable=False)
    fecha = Column(String, nullable=False)        # "YYYY-MM-DD"
    turno_id = Column(Integer, ForeignKey("turnos.id"), nullable=False)
    modelo_id = Column(Integer, ForeignKey("modelos_uph.id"), nullable=True)

    operador = relationship("Operador", back_populates="asignaciones")
    linea = relationship("Linea", back_populates="asignaciones")
    turno = relationship("Turno", back_populates="asignaciones")
    modelo = relationship("ModeloUPH", back_populates="asignaciones")


class EventoUPH(UphBase):
    __tablename__ = "eventos_uph"

    id = Column(Integer, primary_key=True, index=True)
    linea = Column(String, nullable=False)        # "L6"
    estacion = Column(String, nullable=False)     # "604"
    evento = Column(String, nullable=False)       # "GOOD"
    contador = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

