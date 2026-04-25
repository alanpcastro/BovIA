"""pastagens: tabela pastos, historico_ocupacao e FKs em lotes

Revision ID: a7c4e1b2d3f0
Revises: f24ce695144b
Create Date: 2026-04-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c4e1b2d3f0'
down_revision: Union[str, None] = 'f24ce695144b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pastos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(), nullable=False),
        sa.Column('area_ha', sa.Float(), nullable=False),
        sa.Column('capacidade_ua_ha', sa.Float(), nullable=True),
        sa.Column('status', sa.Enum('disponivel', 'ocupado', 'descanso', name='statuspastoenum'), nullable=False, server_default='disponivel'),
        sa.Column('descricao', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pastos_id', 'pastos', ['id'])

    op.create_table(
        'historico_ocupacao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pasto_id', sa.Integer(), nullable=False),
        sa.Column('lote_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('data_entrada', sa.Date(), nullable=False),
        sa.Column('data_saida', sa.Date(), nullable=True),
        sa.Column('observacoes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['pasto_id'], ['pastos.id']),
        sa.ForeignKeyConstraint(['lote_id'], ['lotes.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_historico_ocupacao_id', 'historico_ocupacao', ['id'])

    op.add_column('lotes', sa.Column('pasto_atual_id', sa.Integer(), nullable=True))
    op.add_column('lotes', sa.Column('data_entrada_pasto', sa.Date(), nullable=True))
    op.create_foreign_key('fk_lotes_pasto_atual', 'lotes', 'pastos', ['pasto_atual_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_lotes_pasto_atual', 'lotes', type_='foreignkey')
    op.drop_column('lotes', 'data_entrada_pasto')
    op.drop_column('lotes', 'pasto_atual_id')

    op.drop_index('ix_historico_ocupacao_id', table_name='historico_ocupacao')
    op.drop_table('historico_ocupacao')
    op.drop_index('ix_pastos_id', table_name='pastos')
    op.drop_table('pastos')

    sa.Enum(name='statuspastoenum').drop(op.get_bind(), checkfirst=True)
