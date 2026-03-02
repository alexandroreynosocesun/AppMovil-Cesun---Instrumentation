"""add modelo_observaciones table

Revision ID: 8b2c4e6f9d1a
Revises: 4c2a8f1c3b5d, 7a1b3c5d8e2f
Create Date: 2026-03-01 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '8b2c4e6f9d1a'
down_revision = ('4c2a8f1c3b5d', '7a1b3c5d8e2f')
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS modelo_observaciones (
            id SERIAL NOT NULL,
            modelo_mainboard VARCHAR(100) NOT NULL,
            texto TEXT NOT NULL,
            tecnico_id INTEGER REFERENCES tecnicos(id),
            created_at TIMESTAMP WITHOUT TIME ZONE,
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_modelo_observaciones_id ON modelo_observaciones (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_modelo_observaciones_modelo_mainboard ON modelo_observaciones (modelo_mainboard)")


def downgrade():
    op.drop_index('ix_modelo_observaciones_modelo_mainboard', table_name='modelo_observaciones')
    op.drop_index('ix_modelo_observaciones_id', table_name='modelo_observaciones')
    op.drop_table('modelo_observaciones')
