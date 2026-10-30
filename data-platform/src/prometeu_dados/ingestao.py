"""Uma execução de conector: coletar → guardar no bronze → validar → normalizar → gravar a prata.

A ordem importa. A resposta vai para o bronze antes de ser validada: se a fonte mudou de formato, a
prova do que ela devolveu fica guardada para análise, e nada chega à prata.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from prometeu_dados.bronze import ArmazemDeObjetos
from prometeu_dados.conectores.base import Conector, JanelaDeColeta
from prometeu_dados.prata import EventoDeIntegracao, GravadorPrata, Lote, RegistroPrata, uuid7


def _agora() -> datetime:
    return datetime.now(UTC)


def ingerir(
    conector: Conector,
    janela: JanelaDeColeta,
    armazem: ArmazemDeObjetos,
    gravador: GravadorPrata,
    relogio: Callable[[], datetime] = _agora,
) -> list[EventoDeIntegracao]:
    """Executa o conector na janela e devolve os `LoteIngerido` gravados na outbox."""
    registros: list[RegistroPrata] = []
    for resposta in conector.coletar(janela):
        armazem.guardar(resposta)
        conector.validar(resposta)
        registros.extend(conector.normalizar(resposta))

    lote = Lote(
        fonte=conector.nome,
        versao_do_contrato=conector.versao_do_contrato,
        coletado_de=janela.inicio,
        coletado_ate=janela.fim,
        registros=registros,
    )
    return gravador.gravar(lote, id_de_correlacao=uuid7(relogio()))
