"""Deputados federais da legislatura atual e da anterior, e os períodos em que exerceram mandato.

Produz as tabelas prata `camara_deputado` e `camara_legislatura`, descritas em
`packages/contracts/prata/camara/`. A lista de deputados em exercício não basta: o suplente que
assumiu por alguns meses vota e tem frequência apurada, mas some da lista quando sai. Por isso
o conector percorre todos os deputados da legislatura e lê o histórico de cada um, que traz as datas
de posse, licença, reassunção e afastamento.

A legislatura anterior entra porque o primeiro orçamento de cada legislatura é emendado pela que
termina: os autores das emendas ao orçamento de 2023 são os deputados de 2019 a 2023.

O histórico cobre também as legislaturas anteriores do deputado. A prata guarda todas em que ele
exerceu mandato; quem consome escolhe as que interessam pela `camara_legislatura`.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, urlsplit

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

ENTRA_EM_EXERCICIO = frozenset({"Exercício"})
SAI_DO_EXERCICIO = frozenset(
    {"Licença", "SUPLENCIA", "FIM_MANDATO", "VACANCIA", "SUSPENSO", "Afastado"}
)
NAO_MUDA_O_EXERCICIO = frozenset({"CONVOCADO", None})
"""Situações do histórico. `CONVOCADO` é o suplente chamado que ainda não tomou posse; `None` marca
mudanças de nome ou partido. Uma situação nova faz o conector falhar em vez de adivinhar se o
deputado estava no cargo."""

BRASILIA = timezone(timedelta(hours=-3))
"""Sem horário de verão desde 2019. Os horários do histórico são de Brasília."""


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorDeputadosDaCamara:
    nome = "camara"
    versao_do_contrato = "2.1.0"

    def __init__(
        self,
        cliente: ClienteHttp,
        relogio: Callable[[], datetime] = _agora,
        itens_por_pagina: int = 100,
        consultas_simultaneas: int = 8,
        legislaturas_anteriores: int = 1,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._itens_por_pagina = itens_por_pagina
        self._consultas_simultaneas = consultas_simultaneas
        self._legislaturas_anteriores = legislaturas_anteriores

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """Acha a legislatura do fim da janela e as anteriores, percorre os deputados de cada uma e
        lê o histórico de cada deputado.

        A legislatura anterior é a do dia antes do início da seguinte. A lista da legislatura repete
        o deputado que mudou de partido, e quem foi reeleito aparece nas duas; o histórico é
        buscado uma vez por deputado, em ordem de id.
        """
        dia = janela.fim.astimezone(BRASILIA).date()
        legislaturas: list[int] = []
        for _ in range(self._legislaturas_anteriores + 1):
            resposta = self._buscar(f"{API}/legislaturas?data={dia.isoformat()}")
            yield resposta
            legislatura = self._legislatura(resposta)
            legislaturas.append(legislatura["id"])
            dia = date.fromisoformat(legislatura["dataInicio"]) - timedelta(days=1)

        deputados: set[int] = set()
        for legislatura_id in legislaturas:
            url: str | None = (
                f"{API}/deputados?idLegislatura={legislatura_id}&itens={self._itens_por_pagina}"
                "&ordem=ASC&ordenarPor=nome"
            )
            while url is not None:
                pagina = self._buscar(url)
                yield pagina
                deputados.update(int(deputado["id"]) for deputado in self._deputados(pagina))
                url = _proxima_pagina(_json(pagina))

        urls = [f"{API}/deputados/{id_deputado}/historico" for id_deputado in sorted(deputados)]
        with ThreadPoolExecutor(max_workers=self._consultas_simultaneas) as executor:
            yield from executor.map(self._buscar, urls)

    def validar(self, resposta: RespostaBruta) -> None:
        if _eh_historico(resposta.url):
            self._historico(resposta)
        elif _eh_legislatura(resposta.url):
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
        if not _eh_historico(resposta.url):
            # A lista da legislatura só serve para achar os deputados; os dados vêm do histórico.
            return
        for dados in self._historico(resposta):
            yield RegistroPrata(
                tabela="camara_deputado",
                chave_natural=("id_deputado", "id_legislatura"),
                dados=dados,
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
        dados = _lista(_json(resposta), resposta.url)
        for deputado in dados:
            _exigir(deputado, resposta.url, id=int, idLegislatura=int, nome=str)
        return dados

    def _legislatura(self, resposta: RespostaBruta) -> dict[str, Any]:
        dados = _lista(_json(resposta), resposta.url)
        if len(dados) != 1:
            raise FonteMudouDeFormatoError(
                f"{len(dados)} legislaturas em vez de uma em {resposta.url}"
            )
        legislatura = _exigir(dados[0], resposta.url, id=int, dataInicio=str, dataFim=str)
        try:
            inicio = date.fromisoformat(legislatura["dataInicio"])
            fim = date.fromisoformat(legislatura["dataFim"])
        except ValueError as erro:
            raise FonteMudouDeFormatoError(f"Data fora do formato ISO em {resposta.url}") from erro
        if fim < inicio:
            raise FonteMudouDeFormatoError(
                f"Legislatura termina antes de começar em {resposta.url}"
            )
        return legislatura

    def _historico(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        """Um registro por legislatura em que o deputado exerceu mandato.

        Os dados de identificação são os da entrada mais recente da legislatura; os exercícios são
        os intervalos entre uma entrada em exercício e a saída seguinte. O último fica aberto
        (`fim` nulo) enquanto o deputado está no cargo.
        """
        id_consultado = int(urlsplit(resposta.url).path.split("/")[-2])
        entradas = _lista(_json(resposta), resposta.url)
        por_legislatura: dict[int, list[dict[str, Any]]] = {}
        for entrada in entradas:
            _exigir(entrada, resposta.url, id=int, idLegislatura=int, nome=str, dataHora=str)
            if entrada["id"] != id_consultado:
                raise FonteMudouDeFormatoError(
                    f"Histórico de outro deputado ({entrada['id']}) em {resposta.url}"
                )
            por_legislatura.setdefault(entrada["idLegislatura"], []).append(entrada)

        registros = []
        for legislatura, lista in sorted(por_legislatura.items()):
            ordenadas = sorted(lista, key=lambda e: _instante(e, resposta.url))
            exercicios = _exercicios(ordenadas, resposta.url)
            if not exercicios:
                continue
            atual = ordenadas[-1]
            if atual.get("siglaUf") not in SIGLAS_UF:
                raise FonteMudouDeFormatoError(
                    f"UF desconhecida {atual.get('siglaUf')!r} em {resposta.url}"
                )
            if not isinstance(atual.get("siglaPartido"), str):
                raise FonteMudouDeFormatoError(f"Entrada sem 'siglaPartido' em {resposta.url}")
            registros.append(
                {
                    "id_deputado": id_consultado,
                    "id_legislatura": legislatura,
                    "nome": " ".join(atual["nome"].split()),
                    "sigla_partido": atual["siglaPartido"].strip(),
                    "sigla_uf": atual["siglaUf"],
                    "url_foto": atual.get("urlFoto") or None,
                    "exercicios": exercicios,
                }
            )
        return registros


def _exercicios(entradas: list[dict[str, Any]], url: str) -> list[dict[str, str | None]]:
    exercicios: list[dict[str, str | None]] = []
    inicio: datetime | None = None
    for entrada in entradas:
        situacao = entrada.get("situacao")
        if situacao in ENTRA_EM_EXERCICIO:
            if inicio is None:
                inicio = _instante(entrada, url)
        elif situacao in SAI_DO_EXERCICIO:
            if inicio is not None:
                fim = _instante(entrada, url)
                exercicios.append({"inicio": inicio.isoformat(), "fim": fim.isoformat()})
                inicio = None
        elif situacao not in NAO_MUDA_O_EXERCICIO:
            raise FonteMudouDeFormatoError(f"Situação desconhecida {situacao!r} em {url}")
    if inicio is not None:
        exercicios.append({"inicio": inicio.isoformat(), "fim": None})
    return exercicios


def _instante(entrada: dict[str, Any], url: str) -> datetime:
    try:
        return datetime.strptime(entrada["dataHora"], "%Y-%m-%dT%H:%M").replace(tzinfo=BRASILIA)
    except ValueError as erro:
        raise FonteMudouDeFormatoError(
            f"Data {entrada['dataHora']!r} fora do formato em {url}"
        ) from erro


def _json(resposta: RespostaBruta) -> dict[str, Any]:
    try:
        corpo = json.loads(resposta.conteudo)
    except (UnicodeDecodeError, json.JSONDecodeError) as erro:
        raise FonteMudouDeFormatoError(f"Resposta não é JSON em {resposta.url}") from erro
    if not isinstance(corpo, dict):
        raise FonteMudouDeFormatoError(f"Resposta não é um objeto JSON em {resposta.url}")
    return corpo


def _lista(corpo: dict[str, Any], url: str) -> list[Any]:
    dados = corpo.get("dados")
    if not isinstance(dados, list):
        raise FonteMudouDeFormatoError(f"'dados' não é uma lista em {url}")
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


def _eh_legislatura(url: str) -> bool:
    partes = urlsplit(url)
    return partes.path.endswith("/legislaturas") and "data" in parse_qs(partes.query)


def _eh_historico(url: str) -> bool:
    return urlsplit(url).path.endswith("/historico")
