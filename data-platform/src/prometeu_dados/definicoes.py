"""Ponto de entrada do Dagster: registra ativos, agendas e sensores de todos os conectores.

É a raiz de composição da plataforma de dados: só aqui os adaptadores (HTTP, S3, PostgreSQL) são
montados e entregues aos conectores.
"""

# Sem `from __future__ import annotations`: o Dagster lê a anotação de `context` ao executar.
import os
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Self

from dagster import (
    AssetExecutionContext,
    AssetSelection,
    Config,
    DefaultScheduleStatus,
    DefaultSensorStatus,
    Definitions,
    MaterializeResult,
    OpExecutionContext,
    RunFailureSensorContext,
    ScheduleDefinition,
    asset,
    define_asset_job,
    job,
    op,
    run_failure_sensor,
)

from prometeu_dados.adaptadores.alerta_webhook import AlertaPorWebhook
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
from prometeu_dados.conectores.obrasgov import ConectorObrasDoObrasGov
from prometeu_dados.conectores.portal_transparencia import ConectorEmendasDoPortal
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


BRASILIA = timezone(timedelta(hours=-3))

JANELA_DA_FREQUENCIA = timedelta(days=30)
"""A justificativa da ausência costuma chegar dias depois da sessão; a execução revisita o mês."""

JANELA_DAS_VOTACOES = timedelta(days=30)
"""Revisitar o mês pega correções que a Câmara faça numa votação já publicada."""

JANELA_DAS_PROPOSICOES = timedelta(days=3)
"""Tramitação não muda depois de registrada: três dias cobrem um fim de semana sem execução."""


def _executar(
    context: AssetExecutionContext | OpExecutionContext,
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
        "Deputados federais da legislatura atual e da anterior e seus períodos de exercício, "
        "inclusive suplentes que já saíram (prata: camara_deputado)."
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
        "Senadores da legislatura atual e da anterior e seus períodos de exercício, inclusive "
        "suplentes que já saíram (prata: senado_senador, senado_exercicios)."
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


@asset(
    group_name="portal_transparencia",
    description=(
        "Emendas parlamentares aos orçamentos desde 2023: autor, destino, execução, favorecidos e "
        "convênios (prata: transparencia_emenda, transparencia_emenda_favorecido e "
        "transparencia_emenda_convenio)."
    ),
)
def transparencia_emendas(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    return _executar(context, ConectorEmendasDoPortal, JanelaDeColeta(inicio=agora, fim=agora))


@asset(
    group_name="obrasgov",
    description=(
        "Obras pagas com emendas desde 2023: situação, execução física, paralisações e "
        "localização (prata: obrasgov_empenho_de_emenda, obrasgov_projeto, "
        "obrasgov_execucao_fisica, obrasgov_situacao e obrasgov_localizacao)."
    ),
)
def obrasgov_obras(context: AssetExecutionContext) -> MaterializeResult[None]:
    agora = datetime.now(UTC)
    return _executar(context, ConectorObrasDoObrasGov, JanelaDeColeta(inicio=agora, fim=agora))


CARGAS_HISTORICAS: dict[str, tuple[Callable[[ClienteHttpx], Conector], timedelta | None]] = {
    # O serviço legado devolve o período inteiro de cada deputado numa consulta só, e o custo é
    # quase todo fixo por consulta: dividir só multiplicaria o tempo.
    "camara_frequencia": (ConectorFrequenciaDaCamara, None),
    # A API recusa mais de 3 meses por consulta; um mês por lote mantém o lote pequeno.
    "camara_votacoes": (ConectorVotacoesDaCamara, timedelta(days=30)),
    # A API recusa mais de 1 ano por consulta.
    "senado_votacoes": (ConectorVotacoesDoSenado, timedelta(days=90)),
}


class CargaHistorica(Config):
    """O que carregar e de quando: `de` e `ate` são dias de Brasília, `aaaa-mm-dd`, inclusive."""

    fonte: str
    de: str
    ate: str | None = None


@op
def carregar_historico(context: OpExecutionContext, config: CargaHistorica) -> None:
    """Coleta o período em partes do tamanho que a fonte aceita, uma parte por lote.

    Cada parte é gravada e anunciada antes da seguinte: se a carga parar, basta recomeçar do dia
    da parte que falhou. Regravar uma parte não muda nada, porque a prata é gravada por chave e os
    importadores são idempotentes.
    """
    if config.fonte not in CARGAS_HISTORICAS:
        raise ValueError(f"Carga histórica de {config.fonte!r}: use {sorted(CARGAS_HISTORICAS)}.")
    conector, passo = CARGAS_HISTORICAS[config.fonte]
    inicio = datetime.combine(date.fromisoformat(config.de), time(), BRASILIA)
    fim = (
        datetime.combine(date.fromisoformat(config.ate), time.max, BRASILIA)
        if config.ate
        else datetime.now(UTC)
    )
    janela = JanelaDeColeta(inicio=inicio, fim=fim)
    partes = [janela] if passo is None else janela.em_partes(passo)
    for numero, parte in enumerate(partes, start=1):
        context.log.info(
            f"{config.fonte}: parte {numero} de {len(partes)}, "
            f"{parte.inicio.astimezone(BRASILIA).date()} a {parte.fim.astimezone(BRASILIA).date()}."
        )
        _executar(context, conector, parte)


@job(description="Carga histórica de uma fonte do legislativo, por período (ver o README).")
def carga_historica() -> None:
    carregar_historico()


def _agenda(grupo: str, cron: str = "0 6 * * *") -> ScheduleDefinition:
    """Às 6h de Brasília; todo dia, salvo outro `cron`. Já nasce ligada: o Dagster deixa as agendas
    paradas até alguém ligá-las à mão, e uma coleta esquecida desligada não avisa ninguém."""
    return ScheduleDefinition(
        job=define_asset_job(f"{grupo}_job", selection=AssetSelection.groups(grupo)),
        cron_schedule=cron,
        execution_timezone="America/Sao_Paulo",
        default_status=DefaultScheduleStatus.RUNNING,
    )


@run_failure_sensor(
    default_status=DefaultSensorStatus.RUNNING,
    description="Avisa a equipe pelo webhook de ALERTA_WEBHOOK_URL quando uma coleta falha.",
)
def avisar_falha(context: RunFailureSensorContext) -> None:
    execucao = context.dagster_run
    mensagem = (
        f"Prometeu: a coleta {execucao.job_name} falhou (execução {execucao.run_id}). "
        f"{context.failure_event.message or ''}"
    ).strip()
    if not AlertaPorWebhook(os.environ.get("ALERTA_WEBHOOK_URL")).avisar(mensagem):
        context.log.warning(
            f"Aviso de falha não enviado (sem webhook ou webhook fora do ar): {mensagem}"
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
        transparencia_emendas,
        obrasgov_obras,
    ],
    jobs=[carga_historica],
    sensors=[avisar_falha],
    schedules=[
        _agenda("camara"),
        _agenda("senado"),
        _agenda("portal_transparencia"),
        # Semanal, às segundas: a coleta leva dezenas de minutos, e a obra muda devagar.
        _agenda("obrasgov", cron="0 6 * * 1"),
    ],
)
