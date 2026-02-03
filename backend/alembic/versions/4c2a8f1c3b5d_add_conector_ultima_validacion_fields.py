"""add conector ultima validacion fields

Revision ID: 4c2a8f1c3b5d
Revises: 3f5d8a9c2a1f
Create Date: 2026-02-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4c2a8f1c3b5d'
down_revision = '3f5d8a9c2a1f'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('conectores_adaptador', sa.Column('linea_ultima_validacion', sa.String(length=50), nullable=True))
    op.add_column('conectores_adaptador', sa.Column('turno_ultima_validacion', sa.String(length=20), nullable=True))


def downgrade():
    op.drop_column('conectores_adaptador', 'turno_ultima_validacion')
    op.drop_column('conectores_adaptador', 'linea_ultima_validacion')
