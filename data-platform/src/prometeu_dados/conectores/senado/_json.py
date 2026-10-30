"""Leitura defensiva das respostas JSON dos Dados Abertos do Senado.

O Senado serializa números como texto (`"5672"`) e um item único como objeto em vez de lista; as
funções daqui escondem isso e falham alto quando o formato muda.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError


def corpo(resposta: RespostaBruta) -> Any:
    try:
        return json.loads(resposta.conteudo)
    except (UnicodeDecodeError, json.JSONDecodeError) as erro:
        raise FonteMudouDeFormatoError(f"Resposta não é JSON em {resposta.url}") from erro


def caminho(item: Any, url: str, *chaves: str) -> Any:
    """Desce pelas chaves; uma chave ausente é mudança de formato."""
    atual = item
    for chave in chaves:
        if not isinstance(atual, dict) or chave not in atual:
            raise FonteMudouDeFormatoError(f"Falta {'.'.join(chaves)!r} em {url}")
        atual = atual[chave]
    return atual


def lista(valor: Any) -> list[Any]:
    """O Senado devolve um objeto quando a lista tem um item só, e nada quando está vazia."""
    if valor is None:
        return []
    return valor if isinstance(valor, list) else [valor]


def inteiro(item: Any, campo: str, url: str) -> int:
    valor = item.get(campo) if isinstance(item, dict) else None
    if isinstance(valor, bool) or not (
        isinstance(valor, int) or (isinstance(valor, str) and valor.isdigit())
    ):
        raise FonteMudouDeFormatoError(f"Campo {campo!r} não é um número em {url}")
    return int(valor)


def texto(item: Any, campo: str, url: str) -> str:
    valor = item.get(campo) if isinstance(item, dict) else None
    if not isinstance(valor, str) or not valor.strip():
        raise FonteMudouDeFormatoError(f"Campo {campo!r} ausente ou vazio em {url}")
    return " ".join(valor.split())


def texto_opcional(item: Any, campo: str) -> str | None:
    valor = item.get(campo) if isinstance(item, dict) else None
    if not isinstance(valor, str):
        return None
    return " ".join(valor.split()) or None


def dia(item: Any, campo: str, url: str) -> date:
    try:
        return date.fromisoformat(texto(item, campo, url))
    except ValueError as erro:
        raise FonteMudouDeFormatoError(f"Campo {campo!r} fora do formato ISO em {url}") from erro
