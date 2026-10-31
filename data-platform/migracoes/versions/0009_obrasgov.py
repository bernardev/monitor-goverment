"""Prata das obras do Obrasgov.br ligadas a emendas parlamentares."""

from alembic import op

revision = "0009"
down_revision = "0008"

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

TABELAS = (
    "obrasgov_empenho_de_emenda",
    "obrasgov_projeto",
    "obrasgov_execucao_fisica",
    "obrasgov_situacao",
    "obrasgov_localizacao",
)


def upgrade() -> None:
    op.execute(f"""
        CREATE TABLE ingestao.obrasgov_empenho_de_emenda (
            id_projeto text NOT NULL,
            ug_emitente text NOT NULL,
            numero_empenho text NOT NULL,
            codigo_emenda text NOT NULL,
            acao_orcamentaria text,
            programa_trabalho text,
            plano_interno text,
            valor_empenhado_centavos bigint NOT NULL,
            pago_centavos bigint,
            emitido_em date,
            descricao text,
            {ORIGEM},
            PRIMARY KEY (id_projeto, ug_emitente, numero_empenho, codigo_emenda)
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.obrasgov_projeto (
            id_projeto text PRIMARY KEY,
            nome text NOT NULL,
            descricao text,
            natureza text,
            especie text,
            situacao text NOT NULL,
            uf char(2),
            cep text,
            endereco text,
            inicio_previsto date,
            fim_previsto date,
            inicio_efetivo date,
            fim_efetivo date,
            cadastrado_em date,
            organizacao_responsavel text,
            cnpj_organizacao_responsavel char(14),
            executores jsonb NOT NULL,
            tomadores jsonb NOT NULL,
            repassadores jsonb NOT NULL,
            investimentos_previstos jsonb NOT NULL,
            tipos jsonb NOT NULL,
            localizacoes jsonb NOT NULL,
            sistema_responsavel text,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.obrasgov_execucao_fisica (
            id_execucao bigint PRIMARY KEY,
            id_projeto text NOT NULL,
            percentual_centesimos integer,
            inicio date,
            fim date,
            tipo_instrumento text,
            forma_execucao text,
            cadastrada_em date,
            atualizada_em date,
            motivos jsonb NOT NULL,
            {ORIGEM}
        )
    """)
    op.execute(f"""
        CREATE TABLE ingestao.obrasgov_situacao (
            id_historico bigint PRIMARY KEY,
            id_projeto text NOT NULL,
            situacao text NOT NULL,
            em date NOT NULL,
            justificativa text,
            com_tratativas boolean,
            fase_das_tratativas text,
            {ORIGEM}
        )
    """)
    # A geometria pode não ter município (nulo): a chave trata nulos como iguais.
    op.execute(f"""
        CREATE TABLE ingestao.obrasgov_localizacao (
            id_geometria bigint NOT NULL,
            id_projeto text NOT NULL,
            uf char(2),
            municipio text,
            codigo_municipio_ibge char(7),
            origem text,
            {ORIGEM},
            CONSTRAINT obrasgov_localizacao_chave
                UNIQUE NULLS NOT DISTINCT (id_geometria, codigo_municipio_ibge)
        )
    """)
    for tabela in TABELAS:
        op.execute(f"CREATE INDEX {tabela}_por_lote ON ingestao.{tabela} (lote_id)")
    # O importador junta, por obra, a execução, o histórico e a localização.
    for tabela in ("obrasgov_execucao_fisica", "obrasgov_situacao", "obrasgov_localizacao"):
        op.execute(f"CREATE INDEX {tabela}_por_projeto ON ingestao.{tabela} (id_projeto)")


def downgrade() -> None:
    for tabela in reversed(TABELAS):
        op.execute(f"DROP TABLE ingestao.{tabela}")
