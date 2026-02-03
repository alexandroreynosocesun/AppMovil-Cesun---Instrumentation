"""Add es_dual_conector field to adaptador

Revision ID: 6e4f1a2b3c5d
Revises: 5d3b9e2f4c1a
Create Date: 2026-02-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6e4f1a2b3c5d'
down_revision = '5d3b9e2f4c1a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna es_dual_conector para VByOne que soportan 51+41 pines
    op.add_column('adaptadores', sa.Column('es_dual_conector', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    op.drop_column('adaptadores', 'es_dual_conector')
