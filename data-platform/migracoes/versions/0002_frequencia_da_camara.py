"""Prata da frequência no plenário da Câmara e a correspondência entre matrícula e id da API v2."""

from alembic import op

revision = "0002"
down_revision = "0001"

ORIGEM = """
    lote_id uuid NOT NULL,
    origem_fonte text NOT NULL,
    origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL,
    origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL,
    origem_tipo_de_conteudo text NOT NULL,
    ingerido_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
"""


def upgrade() -> None:
    op.execute(f"""
        CREATE TABLE ingestao.camara_matricula (
            matricula integer PRIMARY KEY,
            id_deputado integer NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.camara_frequencia_dia (
            matricula integer NOT NULL,
            dia date NOT NULL,
            frequencia text NOT NULL,
            justificativa text,
            sessoes jsonb NOT NULL,
            {ORIGEM},
            PRIMARY KEY (matricula, dia)
        )
    """)
    op.execute(
        "CREATE INDEX camara_frequencia_dia_por_lote ON ingestao.camara_frequencia_dia (lote_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE ingestao.camara_frequencia_dia")
    op.execute("DROP TABLE ingestao.camara_matricula")
