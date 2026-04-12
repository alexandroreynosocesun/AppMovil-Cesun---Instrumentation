"""add hora_inicio and hora_fin to asignaciones

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-12

"""
from alembic import op

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE asignaciones
        ADD COLUMN IF NOT EXISTS hora_inicio TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS hora_fin    TIMESTAMPTZ
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_asignaciones_hora
        ON asignaciones(linea_id, fecha, hora_fin)
    """)


def downgrade():
    op.execute("ALTER TABLE asignaciones DROP COLUMN IF EXISTS hora_inicio")
    op.execute("ALTER TABLE asignaciones DROP COLUMN IF EXISTS hora_fin")
