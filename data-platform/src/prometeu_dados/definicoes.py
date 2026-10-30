"""Ponto de entrada do Dagster: registra ativos, agendas e sensores de todos os conectores.

É a raiz de composição da plataforma de dados: só aqui os adaptadores (HTTP, S3, PostgreSQL) são
montados e entregues aos conectores.
"""

# Sem `from __future__ import annotations`: o Dagster lê a anotação de `context` ao executar.
import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Self

from dagster import (
    AssetExecutionContext,
    AssetSelection,
    Definitions,
    MaterializeResult,
    ScheduleDefinition,
    asset,
    define_asset_job,
)

from prometeu_dados.adaptadores.armazem_s3 import ArmazemS3
from prometeu_dados.adaptadores.cliente_httpx import ClienteHttpx
from prometeu_dados.adaptadores.gravador_postgres import GravadorPrataPostgres
from prometeu_dados.conectores import Conector, JanelaDeColeta
from prometeu_dados.conectores.camara import (
    ConectorDeputadosDaCamara,
    ConectorFrequenciaDaCamara,
    ConectorProposicoesDaCamara,
    ConectorVotacoesDaCamara,
)
from prometeu_dados.conectores.senado import (
    ConectorProposicoesDoSenado,
    ConectorSenadoresDoSenado,
    ConectorVotacoesDoSenado,
)
from prometeu_dados.ingestao import ingerir


@dataclass(frozen=True, slots=True)
class Configuracao:
    url_do_banco: str
    s3_endpoint: str
    s3_chave: str
    s3_segredo: str
    balde: str

    @classmethod
    def do_ambiente(cls) -> Self:
        return cls(
            url_do_banco=os.environ["INGESTAO_DATABASE_URL"],
            s3_endpoint=os.environ["S3_ENDPOINT"],
            s3_chave=os.environ["S3_ACCESS_KEY"],
            s3_segredo=os.environ["S3_SECRET_KEY"],
            balde=os.environ.get("S3_BALDE_BRONZE", "prometeu-bronze"),
        )


JANELA_DA_FREQUENCIA = timedelta(days=30)
"""A justificativa da ausência costuma chegar dias depois da sessão; a execução revisita o mês."""

JANELA_DAS_VOTACOES = timedelta(days=30)
"""Revisitar o mês pega correções que a Câmara faça numa votação já publicada."""

JANELA_DAS_PROPOSICOES = timedelta(days=3)
"""Tramitação não muda depois de registrada: três dias cobrem um fim de semana sem execução."""


def _executar(
    context: AssetExecutionContext,
    conector: Callable[[ClienteHttpx], Conector],
    janela: JanelaDeColeta,
) -> MaterializeResult[None]:
    configuracao = Configuracao.do_ambiente()
    armazem = ArmazemS3(
        configuracao.balde,
        configuracao.s3_endpoint,
        configuracao.s3_chave,
        configuracao.s3_segredo,
    )
    armazem.preparar()
    cliente = ClienteHttpx()
    try:
        eventos = ingerir(
            conector(cliente), janela, armazem, GravadorPrataPostgres(configuracao.url_do_banco)
        )
    finally:
        cliente.fechar()
    context.log.info(f"{len(eventos)} lotes gravados na outbox de ingestao.")
    return MaterializeResult(
        metadata={evento.dados["tabela"]: evento.dados["registros"] for evento in eventos}
    )


@asset(
    group_name="camara",
    description=(
        "Deputados federais da legislatura atual e seus períodos de exercício, inclusive suplentes "
        "que já saíram (prata: camara_deputado)."
    ),
)
def camara_deputados(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    return _executar(context, ConectorDeputadosDaCamara, JanelaDeColeta(inicio=agora, fim=agora))


@asset(
    group_name="camara",
    deps=[camara_deputados],
    description=(
        "Frequência dos deputados no plenário nos últimos 30 dias, com a justificativa das "
        "ausências (prata: camara_frequencia_dia)."
    ),
)
def camara_frequencia(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    janela = JanelaDeColeta(inicio=agora - JANELA_DA_FREQUENCIA, fim=agora)
    return _executar(context, ConectorFrequenciaDaCamara, janela)


@asset(
    group_name="camara",
    deps=[camara_deputados],
    description=(
        "Votações nominais do plenário nos últimos 30 dias e o voto de cada deputado "
        "(prata: camara_votacao, camara_votos)."
    ),
)
def camara_votacoes(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    janela = JanelaDeColeta(inicio=agora - JANELA_DAS_VOTACOES, fim=agora)
    return _executar(context, ConectorVotacoesDaCamara, janela)


@asset(
    group_name="senado",
    description=(
        "Senadores da legislatura atual e seus períodos de exercício, inclusive suplentes que já "
        "saíram (prata: senado_senador, senado_exercicios)."
    ),
)
def senado_senadores(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    return _executar(context, ConectorSenadoresDoSenado, JanelaDeColeta(inicio=agora, fim=agora))


@asset(
    group_name="senado",
    deps=[senado_senadores],
    description=(
        "Votações nominais do plenário nos últimos 30 dias, com a situação de cada senador "
        "(prata: senado_votacao)."
    ),
)
def senado_votacoes(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    janela = JanelaDeColeta(inicio=agora - JANELA_DAS_VOTACOES, fim=agora)
    return _executar(context, ConectorVotacoesDoSenado, janela)


@asset(
    group_name="camara",
    deps=[camara_deputados],
    description=(
        "Proposições normativas (PEC, PLP, PL, MPV, PDL) com tramitação nos últimos 3 dias: dados, "
        "autores e tramitação (prata: camara_proposicao, camara_proposicao_autores, "
        "camara_proposicao_tramitacoes)."
    ),
)
def camara_proposicoes(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    janela = JanelaDeColeta(inicio=agora - JANELA_DAS_PROPOSICOES, fim=agora)
    return _executar(context, ConectorProposicoesDaCamara, janela)


@asset(
    group_name="senado",
    deps=[senado_senadores],
    description=(
        "Proposições normativas (PEC, PLP, PL, MPV, PDL) atualizadas nos últimos 3 dias: dados, "
        "autoria e situações (prata: senado_processo)."
    ),
)
def senado_proposicoes(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    janela = JanelaDeColeta(inicio=agora - JANELA_DAS_PROPOSICOES, fim=agora)
    return _executar(context, ConectorProposicoesDoSenado, janela)


def _diaria(grupo: str) -> ScheduleDefinition:
    return ScheduleDefinition(
        job=define_asset_job(f"{grupo}_job", selection=AssetSelection.groups(grupo)),
        cron_schedule="0 6 * * *",
        execution_timezone="America/Sao_Paulo",
    )


defs = Definitions(
    assets=[
        camara_deputados,
        camara_frequencia,
        camara_votacoes,
        camara_proposicoes,
        senado_senadores,
        senado_votacoes,
        senado_proposicoes,
    ],
    schedules=[_diaria("camara"), _diaria("senado")],
)
