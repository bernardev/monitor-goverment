"""Prata das proposições normativas da Câmara e do Senado, e o processo nas votações do Senado."""

from alembic import op

revision = "0006"
down_revision = "0005"

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
        CREATE TABLE ingestao.camara_proposicao (
            id_proposicao integer PRIMARY KEY,
            sigla_tipo text NOT NULL,
            numero integer NOT NULL,
            ano integer NOT NULL,
            ementa text,
            apresentada_em timestamptz NOT NULL,
            url_inteiro_teor text,
            situacao jsonb,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.camara_proposicao_autores (
            id_proposicao integer PRIMARY KEY,
            autores jsonb NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.camara_proposicao_tramitacoes (
            id_proposicao integer PRIMARY KEY,
            tramitacoes jsonb NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.senado_processo (
            id_processo integer PRIMARY KEY,
            codigo_materia integer,
            sigla text NOT NULL,
            numero integer NOT NULL,
            ano integer NOT NULL,
            ementa text,
            apresentada_em date,
            casa_iniciadora text,
            tramitando boolean NOT NULL,
            situacao jsonb,
            autores jsonb NOT NULL,
            situacoes jsonb NOT NULL,
            norma_gerada text,
            url_documento text,
            {ORIGEM}
        )
    """)
    op.execute("CREATE INDEX camara_proposicao_por_lote ON ingestao.camara_proposicao (lote_id)")
    op.execute("CREATE INDEX senado_processo_por_lote ON ingestao.senado_processo (lote_id)")
    op.execute("ALTER TABLE ingestao.senado_votacao ADD COLUMN id_processo integer")


def downgrade() -> None:
    op.execute("ALTER TABLE ingestao.senado_votacao DROP COLUMN id_processo")
    op.execute("DROP TABLE ingestao.senado_processo")
    op.execute("DROP TABLE ingestao.camara_proposicao_tramitacoes")
    op.execute("DROP TABLE ingestao.camara_proposicao_autores")
    op.execute("DROP TABLE ingestao.camara_proposicao")
