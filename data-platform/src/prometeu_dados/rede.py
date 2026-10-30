"""Porta de acesso HTTP às fontes. Conectores dependem dela, nunca de uma biblioteca de HTTP."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True, slots=True)
class RespostaHttp:
    url: str
    status: int
    conteudo: bytes
    tipo_de_conteudo: str
    cabecalhos: Mapping[str, str] = field(default_factory=dict)


class FonteIndisponivelError(Exception):
    """A fonte não respondeu com sucesso; ao contrário de mudar de formato, repetir resolve."""


class ClienteHttp(Protocol):
    def obter(self, url: str) -> RespostaHttp:
        """Faz um GET. Erros de rede e respostas 5xx persistentes viram `FonteIndisponivelError`."""
        ...
