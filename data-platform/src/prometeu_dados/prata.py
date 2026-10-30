"""Camada prata: registros normalizados e o lote que os leva ao schema `ingestao` (ADR-0005).

Cada registro carrega a origem da resposta bruta que o produziu, para que o importador do contexto
dono registre a captura no Acervo antes de gravar o fato (ADR-0016).
"""

from __future__ import annotations

import secrets
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from prometeu_dados.bronze import RespostaBruta


@dataclass(frozen=True, slots=True)
class Origem:
    fonte: str
    url: str
    coletada_em: datetime
    sha256: str
    caminho_no_bronze: str
    tipo_de_conteudo: str

    @classmethod
    def da_resposta(cls, resposta: RespostaBruta) -> Origem:
        return cls(
            fonte=resposta.fonte,
            url=resposta.url,
            coletada_em=resposta.coletado_em,
            sha256=resposta.sha256,
            caminho_no_bronze=str(resposta.caminho_no_bronze()),
            tipo_de_conteudo=resposta.tipo_de_conteudo,
        )


@dataclass(frozen=True, slots=True)
class RegistroPrata:
    """Linha normalizada destinada a uma tabela do schema `ingestao`."""

    tabela: str
    chave_natural: tuple[str, ...]
    """Colunas de `dados` que identificam a linha; regravar a mesma chave atualiza a linha."""
    dados: Mapping[str, Any]
    origem: Origem

    def __post_init__(self) -> None:
        if not self.tabela.isidentifier():
            raise ValueError(f"Nome de tabela inválido: {self.tabela!r}")
        faltando = [coluna for coluna in self.chave_natural if coluna not in self.dados]
        if not self.chave_natural or faltando:
            raise ValueError(f"Chave natural incompleta em {self.tabela}: {faltando}")


@dataclass(frozen=True, slots=True)
class Lote:
    """Resultado de uma execução de um conector, gravado de uma vez só."""

    fonte: str
    versao_do_contrato: str
    coletado_de: datetime
    coletado_ate: datetime
    registros: Sequence[RegistroPrata]

    def por_tabela(self) -> dict[str, list[RegistroPrata]]:
        tabelas: dict[str, list[RegistroPrata]] = {}
        for registro in self.registros:
            tabelas.setdefault(registro.tabela, []).append(registro)
        return tabelas


@dataclass(frozen=True, slots=True)
class EventoDeIntegracao:
    """Envelope de evento (packages/contracts/eventos/envelope.v1.schema.json)."""

    id: str
    tipo: str
    versao: int
    ocorrido_em: datetime
    id_do_agregado: str
    id_de_correlacao: str
    dados: Mapping[str, Any]


def lote_ingerido(
    lote: Lote, tabela: str, registros: int, id_de_correlacao: str, agora: datetime
) -> EventoDeIntegracao:
    """`LoteIngerido` (packages/contracts/eventos/lote-ingerido.v1.schema.json) de uma tabela.

    O id do evento também é gravado em cada linha da tabela (`lote_id`), para que o importador leia
    exatamente as linhas deste lote.
    """
    return EventoDeIntegracao(
        id=uuid7(agora),
        tipo="LoteIngerido",
        versao=1,
        ocorrido_em=agora,
        id_do_agregado=f"{lote.fonte}.{tabela}",
        id_de_correlacao=id_de_correlacao,
        dados={
            "fonte": lote.fonte,
            "tabela": tabela,
            "versaoDoContrato": lote.versao_do_contrato,
            "coletadoDe": lote.coletado_de.isoformat(),
            "coletadoAte": lote.coletado_ate.isoformat(),
            "registros": registros,
        },
    )


def uuid7(instante: datetime | None = None) -> str:
    """UUIDv7 (RFC 9562), o mesmo formato de identificador usado no produto (ADR-0006)."""
    ms = int(instante.timestamp() * 1000) if instante else time.time_ns() // 1_000_000
    aleatorio = bytearray(secrets.token_bytes(10))
    aleatorio[0] = (aleatorio[0] & 0x0F) | 0x70
    aleatorio[2] = (aleatorio[2] & 0x3F) | 0x80
    texto = (ms.to_bytes(6, "big") + bytes(aleatorio)).hex()
    return f"{texto[:8]}-{texto[8:12]}-{texto[12:16]}-{texto[16:20]}-{texto[20:]}"


class GravadorPrata(Protocol):
    def gravar(self, lote: Lote, id_de_correlacao: str) -> list[EventoDeIntegracao]:
        """Grava os registros e um `LoteIngerido` por tabela na outbox, numa única transação."""
        ...
