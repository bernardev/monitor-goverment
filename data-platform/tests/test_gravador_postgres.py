"""Prata e outbox contra PostgreSQL real, com as migrações e as permissões de produção."""

from collections.abc import Iterator
from datetime import UTC, date, datetime
from pathlib import Path

import psycopg
import pytest
from alembic import command
from alembic.config import Config

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.prata import Lote, Origem, RegistroPrata

pytestmark = pytest.mark.integracao

RAIZ = Path(__file__).parents[2]
AGORA = datetime(2026, 10, 30, 9, 0, tzinfo=UTC)


@pytest.fixture(scope="module")
def bancos() -> Iterator[tuple[str, str]]:
    """Sobe o Postgres de produção com o script de schemas e devolve as URLs de ingestao e admin."""
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer(
        "pgvector/pgvector:0.8.7-pg18-trixie",
        username="prometeu_admin",
        password="teste",
        dbname="prometeu",
        driver=None,
    ).with_volume_mapping(
        str(RAIZ / "infra" / "docker" / "postgres"), "/docker-entrypoint-initdb.d", "ro"
    ) as postgres:
        admin = postgres.get_connection_url()
        ingestao = admin.replace("prometeu_admin:teste", "ctx_ingestao:desenvolvimento")
        configuracao = Config(str(RAIZ / "data-platform" / "alembic.ini"))
        with pytest.MonkeyPatch.context() as ambiente:
            ambiente.setenv("INGESTAO_DATABASE_URL", ingestao)
            command.upgrade(configuracao, "head")
        yield ingestao, admin


def deputado(id_deputado: int, partido: str, conteudo: bytes) -> RegistroPrata:
    resposta = RespostaBruta(
        "camara", "https://camara/deputados", AGORA, conteudo, "application/json"
    )
    return RegistroPrata(
        tabela="camara_deputado",
        chave_natural=("id_deputado", "id_legislatura"),
        dados={
            "id_deputado": id_deputado,
            "id_legislatura": 57,
            "nome": "Ana Exemplo",
            "sigla_partido": partido,
            "sigla_uf": "SP",
            "url_foto": None,
            "email": None,
        },
        origem=Origem.da_resposta(resposta),
    )


def legislatura() -> RegistroPrata:
    resposta = RespostaBruta(
        "camara", "https://camara/legislaturas/57", AGORA, b"l", "application/json"
    )
    return RegistroPrata(
        tabela="camara_legislatura",
        chave_natural=("id_legislatura",),
        dados={
            "id_legislatura": 57,
            "data_inicio": date(2023, 2, 1),
            "data_fim": date(2027, 1, 31),
        },
        origem=Origem.da_resposta(resposta),
    )


def lote(*registros: RegistroPrata) -> Lote:
    return Lote("camara", "1.0.0", AGORA, AGORA, registros)


def test_grava_prata_e_um_lote_ingerido_por_tabela(bancos: tuple[str, str]) -> None:
    from prometeu_dados.adaptadores.gravador_postgres import GravadorPrataPostgres

    ingestao, _ = bancos
    gravador = GravadorPrataPostgres(ingestao, relogio=lambda: AGORA)

    gravador.gravar(lote(deputado(1, "PEX", b"v1"), legislatura()), "correlacao-1")
    eventos = gravador.gravar(lote(deputado(1, "PMO", b"v2"), legislatura()), "correlacao-2")

    with psycopg.connect(ingestao) as conexao:
        linhas = conexao.execute(
            "SELECT sigla_partido, origem_sha256, lote_id::text FROM ingestao.camara_deputado"
        ).fetchall()
        outbox = conexao.execute(
            "SELECT tipo, dados->>'tabela', id_de_correlacao FROM ingestao.outbox "
            "WHERE publicado_em IS NULL ORDER BY dados->>'tabela', id_de_correlacao"
        ).fetchall()

    lote_do_deputado = next(e for e in eventos if e.dados["tabela"] == "camara_deputado")
    assert linhas == [("PMO", deputado(1, "PMO", b"v2").origem.sha256, lote_do_deputado.id)]
    assert outbox == [
        ("LoteIngerido", "camara_deputado", "correlacao-1"),
        ("LoteIngerido", "camara_deputado", "correlacao-2"),
        ("LoteIngerido", "camara_legislatura", "correlacao-1"),
        ("LoteIngerido", "camara_legislatura", "correlacao-2"),
    ]


def test_importadores_dos_contextos_leem_a_prata(bancos: tuple[str, str]) -> None:
    _, admin = bancos
    leitor = admin.replace("prometeu_admin:teste", "ctx_agentes_publicos:desenvolvimento")
    with psycopg.connect(leitor) as conexao:
        assert conexao.execute("SELECT count(*) FROM ingestao.camara_legislatura").fetchone() == (
            1,
        )
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conexao.execute("DELETE FROM ingestao.camara_deputado")


def test_listas_vao_para_colunas_jsonb(bancos: tuple[str, str]) -> None:
    from prometeu_dados.adaptadores.gravador_postgres import GravadorPrataPostgres

    ingestao, admin = bancos
    resposta = RespostaBruta("camara", "https://camara/presencas", AGORA, b"p", "text/xml")
    sessoes = [{"descricao": "EXTRAORDINÁRIA Nº 206", "frequencia": "Ausência"}]
    dia = RegistroPrata(
        tabela="camara_frequencia_dia",
        chave_natural=("matricula", "dia"),
        dados={
            "matricula": 701,
            "dia": date(2026, 10, 6),
            "frequencia": "Ausência justificada",
            "justificativa": "Missão Autorizada",
            "sessoes": sessoes,
        },
        origem=Origem.da_resposta(resposta),
    )

    GravadorPrataPostgres(ingestao, relogio=lambda: AGORA).gravar(lote(dia), "correlacao-3")

    leitor = admin.replace("prometeu_admin:teste", "ctx_atividade_legislativa:desenvolvimento")
    with psycopg.connect(leitor) as conexao:
        linha = conexao.execute(
            "SELECT justificativa, sessoes FROM ingestao.camara_frequencia_dia"
        ).fetchone()
    assert linha == ("Missão Autorizada", sessoes)
