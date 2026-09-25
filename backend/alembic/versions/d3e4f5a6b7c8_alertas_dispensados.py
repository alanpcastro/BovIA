"""alertas dispensados pelo produtor

Revision ID: d3e4f5a6b7c8
Revises: c1d2e3f4a5b6
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa


revision = 'd3e4f5a6b7c8'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'alertas_dispensados',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('chave', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'chave', name='uq_alertas_dispensados_user_chave'),
    )
    op.create_index('ix_alertas_dispensados_id', 'alertas_dispensados', ['id'])
    op.create_index('ix_alertas_dispensados_user_id', 'alertas_dispensados', ['user_id'])


def downgrade():
    op.drop_index('ix_alertas_dispensados_user_id', table_name='alertas_dispensados')
    op.drop_index('ix_alertas_dispensados_id', table_name='alertas_dispensados')
    op.drop_table('alertas_dispensados')
