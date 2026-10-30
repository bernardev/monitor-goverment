"""Votações nominais do plenário do Senado, com a situação de cada senador em exercício.

Produz a tabela prata `senado_votacao`, descrita em `packages/contracts/prata/senado/`. Diferente da
Câmara, o Senado lista todos os senadores em exercício em cada votação: quem não votou aparece com o
motivo (licença, missão, atividade parlamentar) ou como presente sem voto.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.senado import _json as j
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

API = "https://legis.senado.leg.br/dadosabertos"

SIGLAS_DE_VOTO = frozenset(
    {
        "Sim",
        "Não",
        "Abstenção",
        "Votou",
        "Presidente (art. 51 RISF)",
        "P-NRV",
        "NCom",
        "AP",
        "LS",
        "MIS",
        "LP",
        "LAP",
        "NA",
    }
)
"""Siglas que o Senado usa em `siglaVotoParlamentar`, conferidas contra 2025 e 2026.

`Votou` é o voto em votação secreta; `P-NRV` é presente que não registrou voto; `NCom` não
compareceu; `AP`, `LS`, `MIS`, `LP` e `LAP` são ausências com motivo; `NA` ("Dispositivo não
citado") não tem legenda pública. Uma sigla nova faz o conector falhar."""

RESULTADOS = {"A": True, "R": False}

BRASILIA = timezone(timedelta(hours=-3))


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorVotacoesDoSenado:
    nome = "senado"
    versao_do_contrato = "1.1.0"

    def __init__(self, cliente: ClienteHttp, relogio: Callable[[], datetime] = _agora) -> None:
        self._cliente = cliente
        self._relogio = relogio

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """Uma consulta traz as votações nominais da janela, já com a situação de cada senador."""
        inicio = janela.inicio.astimezone(BRASILIA).date().isoformat()
        fim = janela.fim.astimezone(BRASILIA).date().isoformat()
        url = f"{API}/votacao?dataInicio={inicio}&dataFim={fim}"
        resposta = self._cliente.obter(url)
        if resposta.status != 200:
            raise FonteIndisponivelError(f"Senado respondeu {resposta.status} para {url}")
        yield RespostaBruta(
            fonte=self.nome,
            url=url,
            coletado_em=self._relogio(),
            conteudo=resposta.conteudo,
            tipo_de_conteudo=resposta.tipo_de_conteudo,
            cabecalhos=dict(resposta.cabecalhos),
        )

    def validar(self, resposta: RespostaBruta) -> None:
        self._votacoes(resposta)

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        for votacao in self._votacoes(resposta):
            yield RegistroPrata(
                tabela="senado_votacao",
                chave_natural=("codigo_sessao_votacao",),
                dados=votacao,
                origem=origem,
            )

    def _votacoes(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        corpo = j.corpo(resposta)
        if not isinstance(corpo, list):
            raise FonteMudouDeFormatoError(f"Resposta não é uma lista em {resposta.url}")
        votacoes = [_votacao(item, resposta.url) for item in corpo]
        codigos = [v["codigo_sessao_votacao"] for v in votacoes]
        if len(set(codigos)) != len(codigos):
            raise FonteMudouDeFormatoError(f"Votação repetida em {resposta.url}")
        return votacoes


def _votacao(item: Any, url: str) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise FonteMudouDeFormatoError(f"Votação não é um objeto em {url}")
    secreta = item.get("votacaoSecreta")
    if secreta not in ("S", "N"):
        raise FonteMudouDeFormatoError(f"'votacaoSecreta' fora do esperado em {url}")
    resultado = item.get("resultadoVotacao")
    if resultado is not None and resultado not in RESULTADOS:
        raise FonteMudouDeFormatoError(f"Resultado desconhecido {resultado!r} em {url}")
    votos = [_voto(v, url) for v in j.lista(item.get("votos"))]
    if not votos:
        raise FonteMudouDeFormatoError(f"Votação nominal sem votos em {url}")
    if len({v["codigo_parlamentar"] for v in votos}) != len(votos):
        raise FonteMudouDeFormatoError(f"Senador repetido numa votação em {url}")
    return {
        "codigo_sessao_votacao": j.inteiro(item, "codigoSessaoVotacao", url),
        "codigo_sessao": j.inteiro(item, "codigoSessao", url),
        "data": j.dia(item, "dataSessao", url),
        "descricao": j.texto(item, "descricaoVotacao", url),
        "identificacao": j.texto_opcional(item, "identificacao"),
        "codigo_materia": item.get("codigoMateria")
        if isinstance(item.get("codigoMateria"), int)
        else None,
        "id_processo": item.get("idProcesso") if isinstance(item.get("idProcesso"), int) else None,
        "sigla_materia": j.texto_opcional(item, "sigla"),
        "numero_materia": j.texto_opcional(item, "numero"),
        "ano_materia": item.get("ano") if isinstance(item.get("ano"), int) else None,
        "ementa": j.texto_opcional(item, "ementa"),
        "aprovada": None if resultado is None else RESULTADOS[resultado],
        "secreta": secreta == "S",
        "votos": votos,
    }


def _voto(item: Any, url: str) -> dict[str, Any]:
    sigla = j.texto(item, "siglaVotoParlamentar", url)
    if sigla not in SIGLAS_DE_VOTO:
        raise FonteMudouDeFormatoError(f"Sigla de voto desconhecida {sigla!r} em {url}")
    return {
        "codigo_parlamentar": j.inteiro(item, "codigoParlamentar", url),
        "sigla_voto": sigla,
        "descricao_voto": j.texto_opcional(item, "descricaoVotoParlamentar"),
        "sigla_partido": j.texto_opcional(item, "siglaPartidoParlamentar"),
        "sigla_uf": j.texto_opcional(item, "siglaUFParlamentar"),
    }
