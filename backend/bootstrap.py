"""
Bootstrap do banco antes de subir a API.

Resolve o problema de a migration inicial (f24ce695144b) assumir tabelas
pre-existentes: num banco novo ela quebra porque so faz add_column.

- Banco NOVO (sem tabela alembic_version): cria todas as tabelas a partir dos
  models atuais e marca o Alembic como 'head' (sem rodar as migrations
  historicas, que assumem tabelas ja existentes).
- Banco EXISTENTE: aplica migrations pendentes normalmente.
"""
from sqlalchemy import inspect
from alembic.config import Config
from alembic import command

from app.database import engine, Base
import app.models  # noqa: F401 -- registra todos os models em Base.metadata


def main() -> None:
    inspector = inspect(engine)
    tabelas = set(inspector.get_table_names())
    alembic_cfg = Config("alembic.ini")

    if "alembic_version" not in tabelas:
        print("[bootstrap] Banco novo detectado — criando tabelas a partir dos models...")
        Base.metadata.create_all(bind=engine)
        command.stamp(alembic_cfg, "head")
        print("[bootstrap] Tabelas criadas e Alembic marcado em head.")
    else:
        print("[bootstrap] Banco existente — aplicando migrations pendentes...")
        command.upgrade(alembic_cfg, "head")
        print("[bootstrap] Migrations aplicadas.")


if __name__ == "__main__":
    main()
