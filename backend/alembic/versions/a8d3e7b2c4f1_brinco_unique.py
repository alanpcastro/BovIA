"""indice unico parcial em animais (user_id, brinco) para brincos ativos

Revision ID: a8d3e7b2c4f1
Revises: f4b07c812a9e
Create Date: 2026-06-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8d3e7b2c4f1'
down_revision: Union[str, None] = '76e03a9d28d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = 'ix_animais_user_brinco_ativo_unique'


def upgrade() -> None:
    # Aborta se houver duplicatas existentes — usuario precisa limpar antes
    conn = op.get_bind()
    dups = conn.execute(sa.text(
        """
        SELECT user_id, brinco, COUNT(*) AS c
        FROM animais
        WHERE deletado_em IS NULL AND brinco IS NOT NULL
        GROUP BY user_id, brinco
        HAVING COUNT(*) > 1
        """
    )).fetchall()
    if dups:
        linhas = "\n".join(f"  user_id={r[0]} brinco={r[1]!r} count={r[2]}" for r in dups)
        raise RuntimeError(
            "Existem brincos duplicados no banco. Resolva antes de aplicar a migration:\n"
            + linhas
        )

    op.create_index(
        INDEX_NAME,
        'animais',
        ['user_id', 'brinco'],
        unique=True,
        postgresql_where=sa.text('deletado_em IS NULL AND brinco IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name='animais')
