"""Ponto de entrada do Dagster: registra ativos, agendas e sensores de todos os conectores.

É a raiz de composição da plataforma de dados: só aqui os adaptadores (HTTP, S3, PostgreSQL) são
montados e entregues aos conectores.
"""

# Sem `from __future__ import annotations`: o Dagster lê a anotação de `context` ao executar.
import os
from dataclasses import dataclass
from datetime import UTC, datetime
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
from prometeu_dados.conectores import JanelaDeColeta
from prometeu_dados.conectores.camara import ConectorDeputadosDaCamara
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


@asset(
    group_name="camara",
    description="Deputados federais em exercício e suas legislaturas (prata: camara_deputado).",
)
def camara_deputados(context: AssetExecutionContext) -> MaterializeResult[None]:
    configuracao = Configuracao.do_ambiente()
    armazem = ArmazemS3(
        configuracao.balde,
        configuracao.s3_endpoint,
        configuracao.s3_chave,
        configuracao.s3_segredo,
    )
    armazem.preparar()
    cliente = ClienteHttpx()
    agora = datetime.now(UTC)
    try:
        eventos = ingerir(
            ConectorDeputadosDaCamara(cliente),
            JanelaDeColeta(inicio=agora, fim=agora),
            armazem,
            GravadorPrataPostgres(configuracao.url_do_banco),
        )
    finally:
        cliente.fechar()
    context.log.info(f"{len(eventos)} lotes gravados na outbox de ingestao.")
    return MaterializeResult(
        metadata={evento.dados["tabela"]: evento.dados["registros"] for evento in eventos}
    )


camara_diaria = ScheduleDefinition(
    job=define_asset_job("camara_job", selection=AssetSelection.groups("camara")),
    cron_schedule="0 6 * * *",
    execution_timezone="America/Sao_Paulo",
)

defs = Definitions(assets=[camara_deputados], schedules=[camara_diaria])
