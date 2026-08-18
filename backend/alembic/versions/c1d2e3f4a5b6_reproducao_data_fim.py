"""reproducao data_fim (fim do período de cobertura natural)

Revision ID: c1d2e3f4a5b6
Revises: b1c2d3e4f5a6
Create Date: 2026-08-14

"""
from alembic import op
import sqlalchemy as sa


revision = 'c1d2e3f4a5b6'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reproducoes', sa.Column('data_fim', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('reproducoes', 'data_fim')
