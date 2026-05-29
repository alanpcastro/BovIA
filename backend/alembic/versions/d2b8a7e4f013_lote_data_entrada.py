"""campo data_entrada no lote

Revision ID: d2b8a7e4f013
Revises: c9e6f1a2d4b5
Create Date: 2026-04-26 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2b8a7e4f013'
down_revision: Union[str, None] = 'c9e6f1a2d4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lotes', sa.Column('data_entrada', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('lotes', 'data_entrada')
