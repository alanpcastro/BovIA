"""campos financeiros: frete e desconto em movimentacoes; novas categorias de despesa

Revision ID: b8d5f2e9c1a0
Revises: a7c4e1b2d3f0
Create Date: 2026-04-16 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8d5f2e9c1a0'
down_revision: Union[str, None] = 'a7c4e1b2d3f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NOVAS_CATEGORIAS = ('sal_mineral', 'suplemento', 'vermifugo', 'combustivel')


def upgrade() -> None:
    op.add_column('movimentacoes', sa.Column('frete', sa.Float(), nullable=True))
    op.add_column('movimentacoes', sa.Column('desconto', sa.Float(), nullable=True))

    # ALTER TYPE ADD VALUE precisa rodar fora de transacao
    with op.get_context().autocommit_block():
        for cat in NOVAS_CATEGORIAS:
            op.execute(f"ALTER TYPE categoriadespenum ADD VALUE IF NOT EXISTS '{cat}'")


def downgrade() -> None:
    op.drop_column('movimentacoes', 'desconto')
    op.drop_column('movimentacoes', 'frete')
    # Removendo valores de enum no PostgreSQL exige recriar o tipo; deixamos no-op.
