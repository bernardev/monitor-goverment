"""Proposições normativas do Senado atualizadas na janela: dados, autoria e situações.

Produz a tabela prata `senado_processo`, descrita em `packages/contracts/prata/senado/`. Entram só
os tipos que podem virar norma (PEC, PLP, PL, MPV e PDL). A API de processos traz, numa consulta por
processo, a autoria, a situação atual, o histórico de situações e a norma gerada.

A fonte filtra por "atualizados nos últimos N dias", com N de no máximo 30.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta, timezone
from math import ceil
from typing import Any
from urllib.parse import urlsplit

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.senado import _json as j
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

API = "https://legis.senado.leg.br/dadosabertos"
TIPOS = ("PEC", "PLP", "PL", "MPV", "PDL")
DIAS_NO_MAXIMO = 30
"""Limite do filtro `numdias` da fonte."""

BRASILIA = timezone(timedelta(hours=-3))


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorProposicoesDoSenado:
    nome = "senado"
    versao_do_contrato = "1.0.0"

    def __init__(self, cliente: ClienteHttp, relogio: Callable[[], datetime] = _agora) -> None:
        self._cliente = cliente
        self._relogio = relogio

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """Lista, por tipo, os processos atualizados desde o início da janela e lê cada um.

        A fonte só filtra pelos últimos N dias contados de hoje: a janela precisa terminar agora e
        começar no máximo 30 dias antes.
        """
        dias = ceil((self._relogio() - janela.inicio).total_seconds() / 86_400)
        if not 1 <= dias <= DIAS_NO_MAXIMO:
            raise ValueError(f"A fonte só cobre de 1 a {DIAS_NO_MAXIMO} dias para trás.")
        ids: list[int] = []
        for tipo in TIPOS:
            lista = self._buscar(f"{API}/processo?sigla={tipo}&numdias={dias}")
            yield lista
            ids.extend(self._ids(lista))
        for id_processo in dict.fromkeys(ids):
            yield self._buscar(f"{API}/processo/{id_processo}")

    def validar(self, resposta: RespostaBruta) -> None:
        if _eh_detalhe(resposta.url):
            self._processo(resposta)
        else:
            self._ids(resposta)

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        if not _eh_detalhe(resposta.url):
            return
        yield RegistroPrata(
            tabela="senado_processo",
            chave_natural=("id_processo",),
            dados=self._processo(resposta),
            origem=Origem.da_resposta(resposta),
        )

    def _buscar(self, url: str) -> RespostaBruta:
        resposta = self._cliente.obter(url)
        if resposta.status != 200:
            raise FonteIndisponivelError(f"Senado respondeu {resposta.status} para {url}")
        return RespostaBruta(
            fonte=self.nome,
            url=url,
            coletado_em=self._relogio(),
            conteudo=resposta.conteudo,
            tipo_de_conteudo=resposta.tipo_de_conteudo,
            cabecalhos=dict(resposta.cabecalhos),
        )

    def _ids(self, resposta: RespostaBruta) -> list[int]:
        corpo = j.corpo(resposta)
        if not isinstance(corpo, list):
            raise FonteMudouDeFormatoError(f"Resposta não é uma lista em {resposta.url}")
        return [j.inteiro(item, "id", resposta.url) for item in corpo]

    def _processo(self, resposta: RespostaBruta) -> dict[str, Any]:
        processo = j.corpo(resposta)
        url = resposta.url
        id_processo = j.inteiro(processo, "id", url)
        if id_processo != int(urlsplit(url).path.rstrip("/").split("/")[-1]):
            raise FonteMudouDeFormatoError(f"Detalhe de outro processo em {url}")
        sigla = j.texto(processo, "sigla", url)
        if sigla not in TIPOS:
            raise FonteMudouDeFormatoError(f"Tipo {sigla!r} fora do filtro em {url}")
        tramitando = processo.get("tramitando")
        if tramitando not in ("Sim", "Não"):
            raise FonteMudouDeFormatoError(f"'tramitando' fora do esperado em {url}")
        documento = processo.get("documento") or {}
        norma = processo.get("normaGerada") or {}
        return {
            "id_processo": id_processo,
            "codigo_materia": processo.get("codigoMateria")
            if isinstance(processo.get("codigoMateria"), int)
            else None,
            "sigla": sigla,
            "numero": j.inteiro(processo, "numero", url),
            "ano": j.inteiro(processo, "ano", url),
            "ementa": j.texto_opcional(processo.get("conteudo"), "ementa"),
            "apresentada_em": j.dia(documento, "dataApresentacao", url)
            if documento.get("dataApresentacao")
            else None,
            "casa_iniciadora": j.texto_opcional(processo, "siglaCasaIniciadora"),
            "tramitando": tramitando == "Sim",
            "situacao": _situacao_atual(processo, url),
            "autores": [_autor(a, url) for a in j.lista(processo.get("autoriaIniciativa"))],
            "situacoes": _situacoes(processo, url),
            "norma_gerada": j.texto_opcional(norma, "descricao"),
            "url_documento": j.texto_opcional(documento, "url"),
        }


def _situacao_atual(processo: dict[str, Any], url: str) -> dict[str, Any] | None:
    sigla = j.texto_opcional(processo, "siglaSituacaoAtual")
    if sigla is None:
        return None
    return {
        "sigla": sigla,
        "descricao": j.texto(processo, "situacaoAtual", url),
        "desde": j.dia(processo, "dataSituacaoAtual", url).isoformat(),
    }


def _autor(item: Any, url: str) -> dict[str, Any]:
    tipo = j.texto(item, "siglaTipo", url)
    codigo = item.get("codigoParlamentar") if isinstance(item, dict) else None
    return {
        "nome": j.texto(item, "autor", url),
        "tipo": tipo,
        # O código é do Senado mesmo quando o autor é deputado; só identifica senadores.
        "codigo_parlamentar": codigo if isinstance(codigo, int) and tipo == "SENADOR" else None,
        "sigla_partido": j.texto_opcional(item, "siglaPartido"),
        "uf": j.texto_opcional(item, "uf"),
        "ordem": j.inteiro(item, "ordem", url),
    }


def _situacoes(processo: dict[str, Any], url: str) -> list[dict[str, Any]]:
    """O histórico de situações da autuação principal, em ordem de início."""
    autuacoes = j.lista(processo.get("autuacoes"))
    principal = next((a for a in autuacoes if isinstance(a, dict) and a.get("numero") == 1), None)
    if principal is None:
        return []
    situacoes = []
    for situacao in j.lista(principal.get("situacoes")):
        colegiado = situacao.get("colegiado") if isinstance(situacao, dict) else None
        situacoes.append(
            {
                "sigla": j.texto(situacao, "sigla", url),
                "descricao": j.texto(situacao, "descricao", url),
                "inicio": j.dia(situacao, "inicio", url).isoformat(),
                "fim": j.dia(situacao, "fim", url).isoformat() if situacao.get("fim") else None,
                "colegiado": j.texto_opcional(colegiado, "sigla"),
            }
        )
    return sorted(situacoes, key=lambda s: s["inicio"])


def _eh_detalhe(url: str) -> bool:
    return urlsplit(url).path.rstrip("/").split("/")[-2] == "processo"
