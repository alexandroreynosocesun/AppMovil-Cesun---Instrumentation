"""add planes_linea table

Revision ID: a1b2c3d4e5f6
Revises: 9c3d5f7a0e2b
Create Date: 2026-04-12

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '9c3d5f7a0e2b'
branch_labels = None
depends_on = None


def upgrade():
    # Esta tabla vive en la DB de UPH (database_uph), no en la principal.
    # Se crea directamente con create_all() al arrancar; esta migración
    # existe como registro. Si la tabla ya existe no falla.
    op.execute("""
        CREATE TABLE IF NOT EXISTS planes_linea (
            id         SERIAL PRIMARY KEY,
            linea_id   INTEGER NOT NULL REFERENCES lineas(id),
            modelo_id  INTEGER NOT NULL REFERENCES modelos_uph(id),
            plan_total INTEGER NOT NULL,
            creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            activo     BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_planes_linea_linea_activo ON planes_linea(linea_id, activo)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS planes_linea")
