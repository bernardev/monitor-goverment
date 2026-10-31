"""Votações nominais do plenário da Câmara e o voto de cada deputado.

Produz as tabelas prata `camara_votacao` e `camara_votos`, descritas em
`packages/contracts/prata/camara/`. A lista de votações do plenário mistura votações simbólicas (sem
voto por deputado) e nominais; só as nominais têm votos e entram na prata.

O deputado ausente não aparece na lista de votos: a fonte não diz quem faltou. Na votação secreta a
lista traz quem votou, mas o voto vem nulo.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any, overload
from urllib.parse import urlsplit

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

API = "https://dadosabertos.camara.leg.br/api/v2"
PLENARIO = 180
"""`idOrgao` do plenário na API."""

VOTOS = frozenset({"Sim", "Não", "Abstenção", "Obstrução", "Artigo 17"})
"""Grafias da Câmara. `Artigo 17` é o presidente da sessão, que só vota para desempatar (art. 17 do
Regimento Interno). Uma grafia nova faz o conector falhar."""

BRASILIA = timezone(timedelta(hours=-3))
"""Sem horário de verão desde 2019. Datas e horários da API são de Brasília."""


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorVotacoesDaCamara:
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
        """Percorre as votações do plenário na janela e, de cada uma, busca os votos.

        A votação com votos tem também o detalhe buscado, que traz as proposições afetadas. A lista
        às vezes traz votação que a própria API diz não existir (404 nos votos e no detalhe): ela
        fica de fora, sem parar a coleta das outras.
        """
        inicio = janela.inicio.astimezone(BRASILIA).date().isoformat()
        fim = janela.fim.astimezone(BRASILIA).date().isoformat()
        url: str | None = (
            f"{API}/votacoes?idOrgao={PLENARIO}&dataInicio={inicio}&dataFim={fim}"
            f"&itens={self._itens_por_pagina}&ordem=ASC&ordenarPor=dataHoraRegistro"
        )
        ids: list[str] = []
        while url is not None:
            pagina = self._buscar(url)
            yield pagina
            ids.extend(votacao["id"] for votacao in self._lista(pagina))
            url = _proxima_pagina(_json(pagina))

        for id_votacao in dict.fromkeys(ids):
            votos = self._buscar(f"{API}/votacoes/{id_votacao}/votos", ausente_e_nada=True)
            if votos is None:
                continue
            yield votos
            if self._votos(votos):
                yield self._buscar(f"{API}/votacoes/{id_votacao}")

    def validar(self, resposta: RespostaBruta) -> None:
        tipo = _tipo(resposta.url)
        if tipo == "votos":
            self._votos(resposta)
        elif tipo == "detalhe":
            self._detalhe(resposta)
        else:
            self._lista(resposta)

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        tipo = _tipo(resposta.url)
        if tipo == "votos":
            votos = self._votos(resposta)
            # Votação simbólica: não há voto por deputado, e nada vai para a prata.
            if votos:
                yield RegistroPrata(
                    tabela="camara_votos",
                    chave_natural=("id_votacao",),
                    dados={"id_votacao": _id_da_votacao(resposta.url), "votos": votos},
                    origem=origem,
                )
        elif tipo == "detalhe":
            yield RegistroPrata(
                tabela="camara_votacao",
                chave_natural=("id_votacao",),
                dados=self._detalhe(resposta),
                origem=origem,
            )

    @overload
    def _buscar(self, url: str) -> RespostaBruta: ...

    @overload
    def _buscar(self, url: str, *, ausente_e_nada: bool) -> RespostaBruta | None: ...

    def _buscar(self, url: str, *, ausente_e_nada: bool = False) -> RespostaBruta | None:
        resposta = self._cliente.obter(url)
        if resposta.status == 404 and ausente_e_nada:
            return None
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
        votacoes = _dados(_json(resposta), list, resposta.url)
        for votacao in votacoes:
            _exigir(votacao, resposta.url, id=str)
        return votacoes

    def _votos(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        votos = []
        vistos: set[int] = set()
        for item in _dados(_json(resposta), list, resposta.url):
            _exigir(item, resposta.url, dataRegistroVoto=str, deputado_=dict)
            deputado = _exigir(item["deputado_"], resposta.url, id=int, siglaPartido=str)
            voto = item.get("tipoVoto")
            if voto is not None and voto not in VOTOS:
                raise FonteMudouDeFormatoError(f"Voto desconhecido {voto!r} em {resposta.url}")
            if deputado["id"] in vistos:
                raise FonteMudouDeFormatoError(
                    f"Deputado {deputado['id']} votou duas vezes em {resposta.url}"
                )
            vistos.add(deputado["id"])
            votos.append(
                {
                    "id_deputado": deputado["id"],
                    "voto": voto,
                    "registrado_em": _instante(item["dataRegistroVoto"], resposta.url).isoformat(),
                    "sigla_partido": deputado["siglaPartido"].strip(),
                    "sigla_uf": deputado.get("siglaUf") or None,
                }
            )
        return votos

    def _detalhe(self, resposta: RespostaBruta) -> dict[str, Any]:
        votacao = _exigir(
            _dados(_json(resposta), dict, resposta.url),
            resposta.url,
            id=str,
            data=str,
            dataHoraRegistro=str,
            descricao=str,
            idOrgao=int,
        )
        if votacao["id"] != _id_da_votacao(resposta.url):
            raise FonteMudouDeFormatoError(f"Detalhe de outra votação em {resposta.url}")
        if votacao["idOrgao"] != PLENARIO:
            raise FonteMudouDeFormatoError(f"Votação fora do plenário em {resposta.url}")
        aprovacao = votacao.get("aprovacao")
        if aprovacao not in (0, 1, None) or isinstance(aprovacao, bool):
            raise FonteMudouDeFormatoError(f"'aprovacao' fora do esperado em {resposta.url}")
        try:
            dia = date.fromisoformat(votacao["data"])
        except ValueError as erro:
            raise FonteMudouDeFormatoError(f"Data fora do formato ISO em {resposta.url}") from erro
        proposicoes = votacao.get("proposicoesAfetadas") or []
        if not isinstance(proposicoes, list):
            raise FonteMudouDeFormatoError(f"'proposicoesAfetadas' não é lista em {resposta.url}")
        return {
            "id_votacao": votacao["id"],
            "data": dia,
            "registrada_em": _instante(votacao["dataHoraRegistro"], resposta.url),
            "descricao": " ".join(votacao["descricao"].split()),
            "aprovacao": None if aprovacao is None else aprovacao == 1,
            "proposicoes": [_proposicao(p, resposta.url) for p in proposicoes],
        }


def _proposicao(item: object, url: str) -> dict[str, Any]:
    proposicao = _exigir(item, url, id=int, siglaTipo=str, numero=int, ano=int)
    return {
        "id": proposicao["id"],
        "sigla_tipo": proposicao["siglaTipo"].strip(),
        "numero": proposicao["numero"],
        "ano": proposicao["ano"],
        "ementa": " ".join((proposicao.get("ementa") or "").split()) or None,
    }


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
    """`lista` (votações do plenário), `votos` ou `detalhe` de uma votação."""
    partes = urlsplit(url).path.rstrip("/").split("/")
    if partes[-1] == "votos":
        return "votos"
    return "detalhe" if partes[-2] == "votacoes" else "lista"


def _id_da_votacao(url: str) -> str:
    partes = urlsplit(url).path.rstrip("/").split("/")
    return partes[-2] if partes[-1] == "votos" else partes[-1]
