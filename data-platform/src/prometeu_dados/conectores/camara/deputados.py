"""Deputados federais em exercício e as legislaturas dos seus mandatos.

Produz as tabelas prata `camara_deputado` e `camara_legislatura`, descritas em
`packages/contracts/prata/camara/`. A fonte é um retrato do momento (quem está em exercício agora),
então a janela de coleta não filtra nada; ela só registra quando o retrato foi tirado.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from typing import Any
from urllib.parse import urlsplit

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

API = "https://dadosabertos.camara.leg.br/api/v2"
SIGLAS_UF = frozenset(
    {
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
        "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
    }
)  # fmt: skip


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorDeputadosDaCamara:
    nome = "camara"
    versao_do_contrato = "1.0.0"

    def __init__(
        self,
        cliente: ClienteHttp,
        relogio: Callable[[], datetime] = _agora,
        itens_por_pagina: int = 100,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._itens_por_pagina = itens_por_pagina

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """Percorre as páginas de deputados e depois busca cada legislatura citada nelas."""
        url: str | None = (
            f"{API}/deputados?itens={self._itens_por_pagina}&ordem=ASC&ordenarPor=nome"
        )
        legislaturas: set[int] = set()
        while url is not None:
            resposta = self._buscar(url)
            yield resposta
            corpo = self._deputados(resposta)
            legislaturas.update(int(deputado["idLegislatura"]) for deputado in corpo)
            url = _proxima_pagina(_json(resposta))
        for legislatura in sorted(legislaturas):
            yield self._buscar(f"{API}/legislaturas/{legislatura}")

    def validar(self, resposta: RespostaBruta) -> None:
        if _eh_legislatura(resposta.url):
            self._legislatura(resposta)
        else:
            self._deputados(resposta)

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        if _eh_legislatura(resposta.url):
            legislatura = self._legislatura(resposta)
            yield RegistroPrata(
                tabela="camara_legislatura",
                chave_natural=("id_legislatura",),
                dados={
                    "id_legislatura": legislatura["id"],
                    "data_inicio": date.fromisoformat(legislatura["dataInicio"]),
                    "data_fim": date.fromisoformat(legislatura["dataFim"]),
                },
                origem=origem,
            )
            return
        for deputado in self._deputados(resposta):
            yield RegistroPrata(
                tabela="camara_deputado",
                chave_natural=("id_deputado", "id_legislatura"),
                dados={
                    "id_deputado": deputado["id"],
                    "id_legislatura": deputado["idLegislatura"],
                    "nome": " ".join(deputado["nome"].split()),
                    "sigla_partido": deputado["siglaPartido"].strip(),
                    "sigla_uf": deputado["siglaUf"],
                    "url_foto": deputado.get("urlFoto") or None,
                    "email": deputado.get("email") or None,
                },
                origem=origem,
            )

    def _buscar(self, url: str) -> RespostaBruta:
        resposta = self._cliente.obter(url)
        if resposta.status != 200:
            raise FonteIndisponivelError(f"Câmara respondeu {resposta.status} para {url}")
        return RespostaBruta(
            fonte=self.nome,
            url=url,
            coletado_em=self._relogio(),
            conteudo=resposta.conteudo,
            tipo_de_conteudo=resposta.tipo_de_conteudo,
            cabecalhos=dict(resposta.cabecalhos),
        )

    def _deputados(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        dados = _json(resposta).get("dados")
        if not isinstance(dados, list):
            raise FonteMudouDeFormatoError(f"'dados' não é uma lista em {resposta.url}")
        for deputado in dados:
            _exigir(deputado, resposta.url, id=int, idLegislatura=int, nome=str, siglaPartido=str)
            if deputado.get("siglaUf") not in SIGLAS_UF:
                raise FonteMudouDeFormatoError(
                    f"UF desconhecida {deputado.get('siglaUf')!r} em {resposta.url}"
                )
        return dados

    def _legislatura(self, resposta: RespostaBruta) -> dict[str, Any]:
        dados = _exigir(
            _json(resposta).get("dados"), resposta.url, id=int, dataInicio=str, dataFim=str
        )
        try:
            inicio = date.fromisoformat(dados["dataInicio"])
            fim = date.fromisoformat(dados["dataFim"])
        except ValueError as erro:
            raise FonteMudouDeFormatoError(f"Data fora do formato ISO em {resposta.url}") from erro
        if fim < inicio:
            raise FonteMudouDeFormatoError(
                f"Legislatura termina antes de começar em {resposta.url}"
            )
        return dados


def _json(resposta: RespostaBruta) -> dict[str, Any]:
    try:
        corpo = json.loads(resposta.conteudo)
    except (UnicodeDecodeError, json.JSONDecodeError) as erro:
        raise FonteMudouDeFormatoError(f"Resposta não é JSON em {resposta.url}") from erro
    if not isinstance(corpo, dict):
        raise FonteMudouDeFormatoError(f"Resposta não é um objeto JSON em {resposta.url}")
    return corpo


def _exigir(item: object, url: str, **campos: type) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise FonteMudouDeFormatoError(f"Item não é um objeto em {url}")
    for campo, tipo in campos.items():
        valor = item.get(campo)
        # bool é subclasse de int em Python; um booleano no lugar de um id é mudança de formato.
        if not isinstance(valor, tipo) or isinstance(valor, bool):
            raise FonteMudouDeFormatoError(f"Campo {campo!r} ausente ou com tipo errado em {url}")
    return item


def _proxima_pagina(corpo: dict[str, Any]) -> str | None:
    links = corpo.get("links")
    if not isinstance(links, list):
        raise FonteMudouDeFormatoError("Resposta paginada sem 'links'")
    for link in links:
        if isinstance(link, dict) and link.get("rel") == "next":
            href = link.get("href")
            return href if isinstance(href, str) else None
    return None


def _eh_legislatura(url: str) -> bool:
    return "/legislaturas/" in urlsplit(url).path
