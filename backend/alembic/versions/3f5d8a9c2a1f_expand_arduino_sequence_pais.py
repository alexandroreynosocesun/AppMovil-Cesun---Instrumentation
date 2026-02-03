"""Expand arduino_sequences.pais length

Revision ID: 3f5d8a9c2a1f
Revises: 1b24c8b6d7a1
Create Date: 2026-01-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3f5d8a9c2a1f'
down_revision = '1b24c8b6d7a1'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'arduino_sequences',
        'pais',
        existing_type=sa.String(length=10),
        type_=sa.String(length=50),
        existing_nullable=True
    )


def downgrade():
    op.alter_column(
        'arduino_sequences',
        'pais',
        existing_type=sa.String(length=50),
        type_=sa.String(length=10),
        existing_nullable=True
    )
