"""categoria do animal

Revision ID: c9e6f1a2d4b5
Revises: b8d5f2e9c1a0
Create Date: 2026-04-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9e6f1a2d4b5'
down_revision: Union[str, None] = 'b8d5f2e9c1a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CATEGORIAS = ('bezerro', 'garrote', 'novilha', 'vaca', 'boi_magro', 'boi_gordo')


def upgrade() -> None:
    categoria_enum = sa.Enum(*CATEGORIAS, name='categoriaanimalenum')
    categoria_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('animais', sa.Column('categoria', categoria_enum, nullable=True))


def downgrade() -> None:
    op.drop_column('animais', 'categoria')
    sa.Enum(name='categoriaanimalenum').drop(op.get_bind(), checkfirst=True)
