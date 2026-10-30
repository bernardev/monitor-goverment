"""Períodos de exercício dos deputados (`camara_deputado` v2.0.0).

O histórico da Câmara não traz e-mail, e nenhum contexto o usava: a coluna sai. Linhas gravadas pela
v1 ficam sem exercícios até a próxima coleta.
"""

from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade() -> None:
    op.execute("ALTER TABLE ingestao.camara_deputado ADD COLUMN exercicios jsonb")
    op.execute("UPDATE ingestao.camara_deputado SET exercicios = '[]'::jsonb")
    op.execute("ALTER TABLE ingestao.camara_deputado ALTER COLUMN exercicios SET NOT NULL")
    op.execute("ALTER TABLE ingestao.camara_deputado DROP COLUMN email")


def downgrade() -> None:
    op.execute("ALTER TABLE ingestao.camara_deputado ADD COLUMN email text")
    op.execute("ALTER TABLE ingestao.camara_deputado DROP COLUMN exercicios")
