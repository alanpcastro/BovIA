"""remove area_hectares do lote (pertence ao pasto)

Revision ID: e3a91c5d7b08
Revises: d2b8a7e4f013
Create Date: 2026-05-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e3a91c5d7b08'
down_revision: Union[str, None] = 'd2b8a7e4f013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('lotes', 'area_hectares')


def downgrade() -> None:
    op.add_column('lotes', sa.Column('area_hectares', sa.Float(), nullable=True))
