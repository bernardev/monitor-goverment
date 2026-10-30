"""Outbox do schema ingestao e prata da Câmara (deputados e legislaturas)."""

from alembic import op

revision = "0001"
down_revision = None

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
    op.execute("""
        CREATE TABLE ingestao.outbox (
            id uuid PRIMARY KEY,
            tipo text NOT NULL,
            versao integer NOT NULL,
            ocorrido_em timestamptz NOT NULL,
            id_do_agregado text NOT NULL,
            id_de_correlacao text NOT NULL,
            dados jsonb NOT NULL,
            publicado_em timestamptz
        )
    """)
    op.execute(
        "CREATE INDEX outbox_pendentes ON ingestao.outbox (ocorrido_em) WHERE publicado_em IS NULL"
    )
    op.execute(f"""
        CREATE TABLE ingestao.camara_legislatura (
            id_legislatura integer PRIMARY KEY,
            data_inicio date NOT NULL,
            data_fim date NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.camara_deputado (
            id_deputado integer NOT NULL,
            id_legislatura integer NOT NULL,
            nome text NOT NULL,
            sigla_partido text NOT NULL,
            sigla_uf char(2) NOT NULL,
            url_foto text,
            email text,
            {ORIGEM},
            PRIMARY KEY (id_deputado, id_legislatura)
        )
    """)
    op.execute("CREATE INDEX camara_deputado_por_lote ON ingestao.camara_deputado (lote_id)")


def downgrade() -> None:
    op.execute("DROP TABLE ingestao.camara_deputado")
    op.execute("DROP TABLE ingestao.camara_legislatura")
    op.execute("DROP TABLE ingestao.outbox")
