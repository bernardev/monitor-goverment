"""Prata dos favorecidos e convênios das emendas parlamentares do Portal da Transparência."""

from alembic import op

revision = "0008"
down_revision = "0007"

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
    # Favorecido somado (pessoas físicas, inscrição genérica, sem informação) não tem documento, e
    # o destino pode faltar: a chave trata nulos como iguais para o upsert achar a linha.
    op.execute(f"""
        CREATE TABLE ingestao.transparencia_emenda_favorecido (
            codigo_emenda text NOT NULL,
            mes char(7) NOT NULL,
            tipo_favorecido text NOT NULL,
            codigo_favorecido text,
            nome_favorecido text,
            natureza_juridica text,
            uf char(2),
            municipio text,
            quantidade integer NOT NULL,
            valor_centavos bigint NOT NULL,
            {ORIGEM},
            CONSTRAINT transparencia_emenda_favorecido_chave UNIQUE NULLS NOT DISTINCT (
                codigo_emenda, mes, tipo_favorecido, codigo_favorecido, uf, municipio
            )
        )
    """)
    # O importador lê o lote em partes, por emenda.
    op.execute(
        "CREATE INDEX transparencia_emenda_favorecido_por_lote "
        "ON ingestao.transparencia_emenda_favorecido (lote_id, codigo_emenda)"
    )
    op.execute(f"""
        CREATE TABLE ingestao.transparencia_emenda_convenio (
            codigo_emenda text NOT NULL,
            numero_convenio text NOT NULL,
            codigo_funcao text NOT NULL,
            nome_funcao text NOT NULL,
            codigo_subfuncao text NOT NULL,
            nome_subfuncao text NOT NULL,
            localidade text NOT NULL,
            publicado_em date NOT NULL,
            convenente text NOT NULL,
            objeto text,
            valor_centavos bigint NOT NULL,
            {ORIGEM},
            PRIMARY KEY (
                codigo_emenda, numero_convenio, codigo_funcao, codigo_subfuncao, localidade
            )
        )
    """)
    op.execute(
        "CREATE INDEX transparencia_emenda_convenio_por_lote "
        "ON ingestao.transparencia_emenda_convenio (lote_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE ingestao.transparencia_emenda_convenio")
    op.execute("DROP TABLE ingestao.transparencia_emenda_favorecido")
