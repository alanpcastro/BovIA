"""adiciona ua_ha no lote (consumo previsto de UA por hectare)

Revision ID: f4b07c812a9e
Revises: e3a91c5d7b08
Create Date: 2026-05-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4b07c812a9e'
down_revision: Union[str, None] = 'e3a91c5d7b08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lotes', sa.Column('ua_ha', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('lotes', 'ua_ha')
