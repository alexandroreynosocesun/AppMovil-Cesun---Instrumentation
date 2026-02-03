"""add_arduino_sequences

Revision ID: 1b24c8b6d7a1
Revises: 0091e68d2791
Create Date: 2026-01-28 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1b24c8b6d7a1'
down_revision = '0091e68d2791'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'arduino_sequences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comando', sa.String(length=50), nullable=False),
        sa.Column('destino', sa.String(length=150), nullable=False),
        sa.Column('pais', sa.String(length=10), nullable=True),
        sa.Column('modelo', sa.String(length=50), nullable=False),
        sa.Column('modelo_interno', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_arduino_sequences_id'), 'arduino_sequences', ['id'], unique=False)
    op.create_index(op.f('ix_arduino_sequences_modelo'), 'arduino_sequences', ['modelo'], unique=False)
    op.create_index(op.f('ix_arduino_sequences_modelo_interno'), 'arduino_sequences', ['modelo_interno'], unique=False)
    op.create_index(op.f('ix_arduino_sequences_pais'), 'arduino_sequences', ['pais'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_arduino_sequences_pais'), table_name='arduino_sequences')
    op.drop_index(op.f('ix_arduino_sequences_modelo_interno'), table_name='arduino_sequences')
    op.drop_index(op.f('ix_arduino_sequences_modelo'), table_name='arduino_sequences')
    op.drop_index(op.f('ix_arduino_sequences_id'), table_name='arduino_sequences')
    op.drop_table('arduino_sequences')
