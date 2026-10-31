"""Contrato comum a todos os conectores de fontes oficiais (ADR-0005, ADR-0012).

Adicionar uma fonte nova (uma assembleia, um tribunal de contas) é implementar este protocolo e
produzir as tabelas prata documentadas em `packages/contracts/prata/`.
O resto da plataforma não muda.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.prata import RegistroPrata


@dataclass(frozen=True, slots=True)
class JanelaDeColeta:
    """Intervalo de tempo que uma execução do conector deve cobrir."""

    inicio: datetime
    fim: datetime

    def __post_init__(self) -> None:
        if self.inicio.tzinfo is None or self.fim.tzinfo is None:
            raise ValueError("A janela de coleta precisa de datas com fuso horário.")
        if self.fim < self.inicio:
            raise ValueError("O fim da janela de coleta é anterior ao início.")

    def em_partes(self, passo: timedelta) -> list[JanelaDeColeta]:
        """Janelas consecutivas de até `passo`, para fontes que limitam o período de uma consulta.

        Cada parte termina um microssegundo antes de a seguinte começar: no calendário, o dia da
        divisa fica numa parte só.
        """
        if passo <= timedelta(0):
            raise ValueError("O passo da divisão da janela precisa ser positivo.")
        partes = []
        inicio = self.inicio
        while inicio + passo < self.fim:
            partes.append(JanelaDeColeta(inicio, inicio + passo - timedelta(microseconds=1)))
            inicio += passo
        partes.append(JanelaDeColeta(inicio, self.fim))
        return partes


class FonteMudouDeFormatoError(Exception):
    """A resposta da fonte não bate com o formato esperado.

    Preferimos falhar alto a gravar dado errado: foi uma mudança silenciosa de formato que parou o
    Serenata de Amor.
    """


class Conector(Protocol):
    nome: str
    """Identificador da fonte, igual ao usado no bronze (`camara`, `senado`, `tse`...)."""

    versao_do_contrato: str
    """Versão semântica do contrato prata que este conector produz."""

    def coletar(self, janela: JanelaDeColeta) -> Iterable[RespostaBruta]:
        """Busca as respostas brutas da fonte para a janela, sem interpretá-las."""
        ...

    def validar(self, resposta: RespostaBruta) -> None:
        """Lança `FonteMudouDeFormatoError` se a resposta não tiver o formato esperado."""
        ...

    def normalizar(self, resposta: RespostaBruta) -> Iterable[RegistroPrata]:
        """Transforma uma resposta já validada em registros da camada prata."""
        ...
