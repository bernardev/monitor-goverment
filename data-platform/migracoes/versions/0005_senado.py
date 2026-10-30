"""Prata do Senado: senadores, os exercícios de cada um e as votações nominais do plenário."""

from alembic import op

revision = "0005"
down_revision = "0004"

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
        CREATE TABLE ingestao.senado_senador (
            codigo integer PRIMARY KEY,
            nome text NOT NULL,
            sigla_partido text,
            url_foto text,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.senado_exercicios (
            codigo integer PRIMARY KEY,
            exercicios jsonb NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.senado_votacao (
            codigo_sessao_votacao integer PRIMARY KEY,
            codigo_sessao integer NOT NULL,
            data date NOT NULL,
            descricao text NOT NULL,
            identificacao text,
            codigo_materia integer,
            sigla_materia text,
            numero_materia text,
            ano_materia integer,
            ementa text,
            aprovada boolean,
            secreta boolean NOT NULL,
            votos jsonb NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute("CREATE INDEX senado_senador_por_lote ON ingestao.senado_senador (lote_id)")
    op.execute("CREATE INDEX senado_votacao_por_lote ON ingestao.senado_votacao (lote_id)")


def downgrade() -> None:
    op.execute("DROP TABLE ingestao.senado_votacao")
    op.execute("DROP TABLE ingestao.senado_exercicios")
    op.execute("DROP TABLE ingestao.senado_senador")
