"""Prata das votações nominais do plenário da Câmara e dos votos de cada uma."""

from alembic import op

revision = "0004"
down_revision = "0003"

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
        CREATE TABLE ingestao.camara_votacao (
            id_votacao text PRIMARY KEY,
            data date NOT NULL,
            registrada_em timestamptz NOT NULL,
            descricao text NOT NULL,
            aprovacao boolean,
            proposicoes jsonb NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.camara_votos (
            id_votacao text PRIMARY KEY,
            votos jsonb NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute("CREATE INDEX camara_votacao_por_lote ON ingestao.camara_votacao (lote_id)")


def downgrade() -> None:
    op.execute("DROP TABLE ingestao.camara_votos")
    op.execute("DROP TABLE ingestao.camara_votacao")
