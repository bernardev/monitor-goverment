"""Proposições normativas da Câmara com movimentação na janela: dados, autores e tramitação.

Produz as tabelas prata `camara_proposicao`, `camara_proposicao_autores` e
`camara_proposicao_tramitacoes`, descritas em `packages/contracts/prata/camara/`. Entram só os tipos
que podem virar norma (PEC, PLP, PL, MPV e PDL); requerimentos, pareceres e outros documentos de
trâmite ficam de fora.

Cada proposição custa três consultas (detalhe, autores e tramitações); quatro correm ao mesmo tempo
(com mais, a Câmara responde 429), e as respostas saem na ordem dos ids.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

API = "https://dadosabertos.camara.leg.br/api/v2"
TIPOS = ("PEC", "PLP", "PL", "MPV", "PDL")
"""Proposições que podem virar norma: emenda constitucional, lei complementar, lei ordinária,
medida provisória e decreto legislativo."""

BRASILIA = timezone(timedelta(hours=-3))
"""Sem horário de verão desde 2019. Datas e horários da API são de Brasília."""


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorProposicoesDaCamara:
    nome = "camara"
    versao_do_contrato = "1.0.0"

    def __init__(
        self,
        cliente: ClienteHttp,
        relogio: Callable[[], datetime] = _agora,
        itens_por_pagina: int = 100,
        consultas_simultaneas: int = 4,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._itens_por_pagina = itens_por_pagina
        self._consultas_simultaneas = consultas_simultaneas

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """Lista as proposições com tramitação na janela e busca detalhe, autores e tramitações."""
        inicio = janela.inicio.astimezone(BRASILIA).date().isoformat()
        fim = janela.fim.astimezone(BRASILIA).date().isoformat()
        tipos = "".join(f"siglaTipo={tipo}&" for tipo in TIPOS)
        url: str | None = (
            f"{API}/proposicoes?{tipos}dataInicio={inicio}&dataFim={fim}"
            f"&itens={self._itens_por_pagina}&ordem=ASC&ordenarPor=id"
        )
        ids: list[int] = []
        while url is not None:
            pagina = self._buscar(url)
            yield pagina
            ids.extend(p["id"] for p in self._lista(pagina))
            url = _proxima_pagina(_json(pagina))

        urls = [
            f"{API}/proposicoes/{id_proposicao}{sufixo}"
            for id_proposicao in dict.fromkeys(ids)
            for sufixo in ("", "/autores", "/tramitacoes")
        ]
        with ThreadPoolExecutor(max_workers=self._consultas_simultaneas) as executor:
            yield from executor.map(self._buscar, urls)

    def validar(self, resposta: RespostaBruta) -> None:
        tipo = _tipo(resposta.url)
        if tipo == "detalhe":
            self._detalhe(resposta)
        elif tipo == "autores":
            self._autores(resposta)
        elif tipo == "tramitacoes":
            self._tramitacoes(resposta)
        else:
            self._lista(resposta)

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        tipo = _tipo(resposta.url)
        id_proposicao = _id_na_url(resposta.url) if tipo != "lista" else 0
        if tipo == "detalhe":
            dados: dict[str, Any] = self._detalhe(resposta)
            tabela = "camara_proposicao"
        elif tipo == "autores":
            dados = {"id_proposicao": id_proposicao, "autores": self._autores(resposta)}
            tabela = "camara_proposicao_autores"
        elif tipo == "tramitacoes":
            dados = {"id_proposicao": id_proposicao, "tramitacoes": self._tramitacoes(resposta)}
            tabela = "camara_proposicao_tramitacoes"
        else:
            # A lista só serve para achar as proposições; os dados vêm do detalhe.
            return
        yield RegistroPrata(
            tabela=tabela, chave_natural=("id_proposicao",), dados=dados, origem=origem
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

    def _lista(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        proposicoes = _dados(_json(resposta), list, resposta.url)
        for proposicao in proposicoes:
            _exigir(proposicao, resposta.url, id=int, siglaTipo=str)
            if proposicao["siglaTipo"] not in TIPOS:
                raise FonteMudouDeFormatoError(
                    f"Tipo {proposicao['siglaTipo']!r} fora do filtro em {resposta.url}"
                )
        return proposicoes

    def _detalhe(self, resposta: RespostaBruta) -> dict[str, Any]:
        proposicao = _exigir(
            _dados(_json(resposta), dict, resposta.url),
            resposta.url,
            id=int,
            siglaTipo=str,
            numero=int,
            ano=int,
            ementa=str,
            dataApresentacao=str,
        )
        if proposicao["id"] != _id_na_url(resposta.url):
            raise FonteMudouDeFormatoError(f"Detalhe de outra proposição em {resposta.url}")
        status = proposicao.get("statusProposicao")
        return {
            "id_proposicao": proposicao["id"],
            "sigla_tipo": proposicao["siglaTipo"].strip(),
            "numero": proposicao["numero"],
            "ano": proposicao["ano"],
            "ementa": _texto(proposicao["ementa"]) or None,
            "apresentada_em": _instante(proposicao["dataApresentacao"], resposta.url),
            "url_inteiro_teor": proposicao.get("urlInteiroTeor") or None,
            "situacao": None if not isinstance(status, dict) else _tramitacao(status, resposta.url),
        }

    def _autores(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        autores = []
        for autor in _dados(_json(resposta), list, resposta.url):
            _exigir(autor, resposta.url, nome=str, tipo=str, ordemAssinatura=int)
            uri = autor.get("uri") or ""
            caminho = urlsplit(uri).path.rstrip("/").split("/")
            id_deputado = (
                int(caminho[-1]) if len(caminho) > 1 and caminho[-2] == "deputados" else None
            )
            autores.append(
                {
                    "nome": _texto(autor["nome"]),
                    "tipo": _texto(autor["tipo"]),
                    "id_deputado": id_deputado,
                    "ordem_assinatura": autor["ordemAssinatura"],
                    "proponente": autor.get("proponente") == 1,
                }
            )
        return autores

    def _tramitacoes(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        tramitacoes = [
            _tramitacao(item, resposta.url) for item in _dados(_json(resposta), list, resposta.url)
        ]
        # A sequência não identifica a tramitação: a Câmara repete o número quando registra dois
        # despachos do mesmo ato. A ordenação é estável e guarda a ordem da fonte entre eles.
        return sorted(tramitacoes, key=lambda t: t["sequencia"])


def _tramitacao(item: object, url: str) -> dict[str, Any]:
    tramitacao = _exigir(item, url, dataHora=str, sequencia=int)
    return {
        "sequencia": tramitacao["sequencia"],
        "data_hora": _instante(tramitacao["dataHora"], url).isoformat(),
        "sigla_orgao": _texto(tramitacao.get("siglaOrgao")) or None,
        "descricao_tramitacao": _texto(tramitacao.get("descricaoTramitacao")) or None,
        "descricao_situacao": _texto(tramitacao.get("descricaoSituacao")) or None,
        "despacho": _texto(tramitacao.get("despacho")) or None,
        "url": tramitacao.get("url") or None,
    }


def _texto(valor: object) -> str:
    return " ".join(valor.split()) if isinstance(valor, str) else ""


def _instante(texto: str, url: str) -> datetime:
    try:
        return datetime.fromisoformat(texto).replace(tzinfo=BRASILIA)
    except ValueError as erro:
        raise FonteMudouDeFormatoError(f"Data {texto!r} fora do formato em {url}") from erro


def _json(resposta: RespostaBruta) -> dict[str, Any]:
    try:
        corpo = json.loads(resposta.conteudo)
    except (UnicodeDecodeError, json.JSONDecodeError) as erro:
        raise FonteMudouDeFormatoError(f"Resposta não é JSON em {resposta.url}") from erro
    if not isinstance(corpo, dict):
        raise FonteMudouDeFormatoError(f"Resposta não é um objeto JSON em {resposta.url}")
    return corpo


def _dados[T](corpo: dict[str, Any], tipo: type[T], url: str) -> T:
    dados = corpo.get("dados")
    if not isinstance(dados, tipo):
        raise FonteMudouDeFormatoError(f"'dados' com formato inesperado em {url}")
    return dados


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


def _tipo(url: str) -> str:
    """`lista`, `detalhe`, `autores` ou `tramitacoes`."""
    partes = urlsplit(url).path.rstrip("/").split("/")
    if partes[-1] in ("autores", "tramitacoes"):
        return partes[-1]
    return "detalhe" if partes[-2] == "proposicoes" else "lista"


def _id_na_url(url: str) -> int:
    partes = urlsplit(url).path.rstrip("/").split("/")
    return int(partes[-2] if partes[-1] in ("autores", "tramitacoes") else partes[-1])
