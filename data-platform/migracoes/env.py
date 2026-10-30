"""Ambiente do Alembic: aplica as migrações com o usuário do contexto `ingestao`."""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import create_engine

SCHEMA = "ingestao"


def _url() -> str:
    url = os.environ.get("INGESTAO_DATABASE_URL")
    if not url:
        raise RuntimeError("Defina INGESTAO_DATABASE_URL para aplicar as migrações.")
    return url.replace("postgres://", "postgresql+psycopg://", 1).replace(
        "postgresql://", "postgresql+psycopg://", 1
    )


def migrar() -> None:
    motor = create_engine(_url())
    with motor.connect() as conexao:
        context.configure(
            connection=conexao,
            version_table="__migracoes",
            version_table_schema=SCHEMA,
            transaction_per_migration=True,
        )
        with context.begin_transaction():
            context.run_migrations()


migrar()
