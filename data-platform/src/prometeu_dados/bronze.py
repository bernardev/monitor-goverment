"""Camada bronze: a resposta bruta de uma fonte, exatamente como chegou (ADR-0005, ADR-0009).

Nada aqui interpreta o conteúdo. O objetivo é guardar a prova: o que a fonte devolveu, quando e com
qual hash, para que qualquer dado publicado possa ser rastreado até a origem e reprocessado.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Protocol


@dataclass(frozen=True, slots=True)
class RespostaBruta:
    fonte: str
    url: str
    coletado_em: datetime
    conteudo: bytes
    tipo_de_conteudo: str
    cabecalhos: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.fonte or not self.fonte.isidentifier():
            raise ValueError(f"Nome de fonte inválido: {self.fonte!r}")
        if self.coletado_em.tzinfo is None:
            raise ValueError("coletado_em precisa ter fuso horário (usamos UTC).")

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.conteudo).hexdigest()

    def caminho_no_bronze(self) -> PurePosixPath:
        """Chave no armazenamento de objetos: particionada por fonte e data, endereçada pelo hash.

        Endereçar pelo hash torna a gravação idempotente: coletar duas vezes o mesmo conteúdo não
        duplica o arquivo.
        """
        instante = self.coletado_em.astimezone(UTC)
        return PurePosixPath(
            "bronze",
            self.fonte,
            f"{instante:%Y}",
            f"{instante:%m}",
            f"{instante:%d}",
            self.sha256,
        )


class ArmazemDeObjetos(Protocol):
    """Onde o bronze mora (armazenamento de objetos S3-compatível, ADR-0006)."""

    def guardar(self, resposta: RespostaBruta) -> None:
        """Grava em `caminho_no_bronze()`. Guardar de novo o mesmo conteúdo não muda nada."""
        ...
