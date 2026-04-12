"""add descansos_linea table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-12

"""
from alembic import op

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS descansos_linea (
            id        SERIAL PRIMARY KEY,
            linea_id  INTEGER NOT NULL REFERENCES lineas(id),
            inicio    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            fin       TIMESTAMPTZ,
            activo    BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_descansos_linea_activo ON descansos_linea(linea_id, activo)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS descansos_linea")
