"""add foto column to modelo_observaciones

Revision ID: 9c3d5f7a0e2b
Revises: 8b2c4e6f9d1a
Create Date: 2026-03-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9c3d5f7a0e2b'
down_revision = '8b2c4e6f9d1a'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE modelo_observaciones ADD COLUMN IF NOT EXISTS foto TEXT")


def downgrade():
    op.drop_column('modelo_observaciones', 'foto')
