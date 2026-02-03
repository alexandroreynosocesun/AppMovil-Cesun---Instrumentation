"""add jig ultima validacion fields

Revision ID: 5d3b9e2f4c1a
Revises: 4c2a8f1c3b5d
Create Date: 2026-02-01 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5d3b9e2f4c1a'
down_revision = '4c2a8f1c3b5d'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('jigs', sa.Column('fecha_ultima_validacion', sa.DateTime(), nullable=True))
    op.add_column('jigs', sa.Column('tecnico_ultima_validacion_id', sa.Integer(), nullable=True))
    op.add_column('jigs', sa.Column('turno_ultima_validacion', sa.String(length=20), nullable=True))
    op.create_foreign_key(
        'fk_jigs_tecnico_ultima_validacion',
        'jigs',
        'tecnicos',
        ['tecnico_ultima_validacion_id'],
        ['id']
    )


def downgrade():
    op.drop_constraint('fk_jigs_tecnico_ultima_validacion', 'jigs', type_='foreignkey')
    op.drop_column('jigs', 'turno_ultima_validacion')
    op.drop_column('jigs', 'tecnico_ultima_validacion_id')
    op.drop_column('jigs', 'fecha_ultima_validacion')
