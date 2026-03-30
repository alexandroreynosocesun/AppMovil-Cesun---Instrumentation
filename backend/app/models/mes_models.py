from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from ..database import Base


class MESRegistro(Base):
    __tablename__ = "mes_registros"

    id          = Column(Integer, primary_key=True, index=True)
    estacion_id = Column(String, nullable=False, index=True)   # ej. "FCT-1"
    modelo      = Column(String, nullable=True)                 # modelo detectado

    # Estación A
    ok_a        = Column(Integer, nullable=True)
    ng_a        = Column(Integer, nullable=True)
    pass_pct_a  = Column(Float,   nullable=True)

    # Estación B
    ok_b        = Column(Integer, nullable=True)
    ng_b        = Column(Integer, nullable=True)
    pass_pct_b  = Column(Float,   nullable=True)

    capturado_en = Column(DateTime(timezone=True), server_default=func.now(), index=True)
