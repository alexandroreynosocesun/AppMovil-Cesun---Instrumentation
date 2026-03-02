"""add foto_ng to conectores_adaptador

Revision ID: 7a1b3c5d8e2f
Revises: 2eed5cdad06e
Create Date: 2026-03-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7a1b3c5d8e2f'
down_revision = '2eed5cdad06e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('conectores_adaptador', sa.Column('foto_ng', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('conectores_adaptador', 'foto_ng')
