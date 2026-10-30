"""Prata das emendas parlamentares do Portal da Transparência."""

from alembic import op

revision = "0007"
down_revision = "0006"

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
        CREATE TABLE ingestao.transparencia_emenda (
            codigo_emenda text NOT NULL,
            ano integer NOT NULL,
            tipo text NOT NULL,
            codigo_autor text NOT NULL,
            nome_autor text NOT NULL,
            numero_emenda text NOT NULL,
            localidade text NOT NULL,
            codigo_municipio_ibge char(7),
            codigo_uf_ibge char(7),
            codigo_funcao text NOT NULL,
            nome_funcao text NOT NULL,
            codigo_subfuncao text NOT NULL,
            nome_subfuncao text NOT NULL,
            codigo_programa text NOT NULL,
            nome_programa text NOT NULL,
            codigo_acao text NOT NULL,
            nome_acao text NOT NULL,
            codigo_plano_orcamentario text NOT NULL,
            nome_plano_orcamentario text NOT NULL,
            empenhado_centavos bigint NOT NULL,
            liquidado_centavos bigint NOT NULL,
            pago_centavos bigint NOT NULL,
            restos_inscritos_centavos bigint NOT NULL,
            restos_cancelados_centavos bigint NOT NULL,
            restos_pagos_centavos bigint NOT NULL,
            {ORIGEM},
            PRIMARY KEY (
                codigo_emenda, localidade, codigo_funcao, codigo_subfuncao, codigo_programa,
                codigo_acao, codigo_plano_orcamentario
            )
        )
    """)
    op.execute(
        "CREATE INDEX transparencia_emenda_por_lote ON ingestao.transparencia_emenda (lote_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE ingestao.transparencia_emenda")
