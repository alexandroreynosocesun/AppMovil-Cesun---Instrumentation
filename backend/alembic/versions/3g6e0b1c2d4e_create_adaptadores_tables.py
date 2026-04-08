"""create adaptadores tables

Revision ID: 3g6e0b1c2d4e
Revises: 3f5d8a9c2a1f
Create Date: 2026-01-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '3g6e0b1c2d4e'
down_revision = '3f5d8a9c2a1f'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'adaptadores',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('codigo_qr', sa.String(length=50), nullable=False),
        sa.Column('numero_adaptador', sa.String(length=50), nullable=False),
        sa.Column('modelo_adaptador', sa.String(length=100), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('codigo_qr'),
    )
    op.create_index(op.f('ix_adaptadores_id'), 'adaptadores', ['id'], unique=False)
    op.create_index(op.f('ix_adaptadores_codigo_qr'), 'adaptadores', ['codigo_qr'], unique=True)

    op.create_table(
        'conectores_adaptador',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('adaptador_id', sa.Integer(), nullable=False),
        sa.Column('nombre_conector', sa.String(length=100), nullable=False),
        sa.Column('estado', sa.String(length=10), nullable=False),
        sa.Column('fecha_estado_ng', sa.DateTime(), nullable=True),
        sa.Column('tecnico_ng_id', sa.Integer(), nullable=True),
        sa.Column('usuario_reporte_ng', sa.String(length=100), nullable=True),
        sa.Column('comentario_ng', sa.Text(), nullable=True),
        sa.Column('fecha_ultima_validacion', sa.DateTime(), nullable=True),
        sa.Column('tecnico_ultima_validacion_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['adaptador_id'], ['adaptadores.id'], ),
        sa.ForeignKeyConstraint(['tecnico_ng_id'], ['tecnicos.id'], ),
        sa.ForeignKeyConstraint(['tecnico_ultima_validacion_id'], ['tecnicos.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_conectores_adaptador_id'), 'conectores_adaptador', ['id'], unique=False)

    op.create_table(
        'validaciones_adaptador',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('adaptador_id', sa.Integer(), nullable=False),
        sa.Column('tecnico_id', sa.Integer(), nullable=False),
        sa.Column('fecha', sa.DateTime(), nullable=True),
        sa.Column('turno', sa.String(length=20), nullable=False),
        sa.Column('estado_general', sa.String(length=10), nullable=False),
        sa.Column('comentario', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['adaptador_id'], ['adaptadores.id'], ),
        sa.ForeignKeyConstraint(['tecnico_id'], ['tecnicos.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_validaciones_adaptador_id'), 'validaciones_adaptador', ['id'], unique=False)

    op.create_table(
        'validaciones_conector',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('validacion_adaptador_id', sa.Integer(), nullable=False),
        sa.Column('conector_id', sa.Integer(), nullable=False),
        sa.Column('estado', sa.String(length=10), nullable=False),
        sa.Column('comentario', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['conector_id'], ['conectores_adaptador.id'], ),
        sa.ForeignKeyConstraint(['validacion_adaptador_id'], ['validaciones_adaptador.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_validaciones_conector_id'), 'validaciones_conector', ['id'], unique=False)

    op.create_table(
        'modelos_mainboard_conector',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre_conector', sa.String(length=100), nullable=False),
        sa.Column('modelo_mainboard', sa.String(length=100), nullable=False),
        sa.Column('modelo_interno', sa.Text(), nullable=True),
        sa.Column('tool_sw', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre_conector', 'modelo_mainboard', name='uq_conector_modelo'),
    )
    op.create_index(op.f('ix_modelos_mainboard_conector_id'), 'modelos_mainboard_conector', ['id'], unique=False)
    op.create_index(op.f('ix_modelos_mainboard_conector_nombre_conector'), 'modelos_mainboard_conector', ['nombre_conector'], unique=False)


def downgrade():
    op.drop_table('modelos_mainboard_conector')
    op.drop_table('validaciones_conector')
    op.drop_table('validaciones_adaptador')
    op.drop_table('conectores_adaptador')
    op.drop_table('adaptadores')
