"""lote do animal gravado na movimentacao (analise por lote)

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-09-28

Sem backfill: nao ha como saber de qual lote saiu um animal ja vendido. Lancamentos antigos
ficam com lote_id NULL e a analise por lote usa, para eles, o lote atual do animal — o
comportamento de antes.
"""
from alembic import op
import sqlalchemy as sa


revision = 'e4f5a6b7c8d9'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('movimentacoes', sa.Column('lote_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'movimentacoes_lote_id_fkey', 'movimentacoes', 'lotes',
        ['lote_id'], ['id'], ondelete='SET NULL',
    )


def downgrade():
    op.drop_constraint('movimentacoes_lote_id_fkey', 'movimentacoes', type_='foreignkey')
    op.drop_column('movimentacoes', 'lote_id')
