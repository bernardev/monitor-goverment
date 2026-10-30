"""Frequência dos deputados nos dias de sessão do plenário, com a justificativa da ausência.

Produz as tabelas prata `camara_matricula` e `camara_frequencia_dia`, descritas em
`packages/contracts/prata/camara/`. A API de Dados Abertos v2 não publica a justificativa; ela só
existe no serviço legado SitCamaraWS, que identifica o deputado pela matrícula (carteira
parlamentar). Por isso o conector também grava a correspondência entre matrícula e id da API v2.

A justificativa costuma ser registrada dias depois da sessão, então a janela de coleta deve cobrir
algumas semanas para trás: regravar o mesmo dia atualiza a linha.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, urlsplit
from xml.etree.ElementTree import Element, ParseError

from defusedxml import DefusedXmlException
from defusedxml.ElementTree import fromstring

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

SERVICO = "https://www.camara.leg.br/SitCamaraWS"
DEPUTADOS = f"{SERVICO}/Deputados.asmx/ObterDeputados"
PRESENCAS = f"{SERVICO}/sessoesreunioes.asmx/ListarPresencasParlamentar"

FREQUENCIAS = frozenset({"Presença", "Presença (~)", "Ausência", "Ausência justificada"})
"""Grafias que a Câmara usa. Uma grafia nova faz o conector falhar em vez de gravar algo que ninguém
sabe interpretar."""

BRASILIA = timezone(timedelta(hours=-3))
"""Sem horário de verão desde 2019. As datas do serviço são do calendário de Brasília."""


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorFrequenciaDaCamara:
    nome = "camara"
    versao_do_contrato = "1.0.0"

    def __init__(
        self,
        cliente: ClienteHttp,
        relogio: Callable[[], datetime] = _agora,
        consultas_simultaneas: int = 4,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._consultas_simultaneas = consultas_simultaneas

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """Lista os deputados e busca a frequência de cada matrícula na janela.

        O serviço leva vários segundos por deputado; algumas consultas correm ao mesmo tempo, mas as
        respostas saem na ordem das matrículas.
        """
        deputados = self._buscar(DEPUTADOS)
        if deputados is None:
            raise FonteIndisponivelError(f"Câmara respondeu 404 para {DEPUTADOS}")
        yield deputados
        inicio = janela.inicio.astimezone(BRASILIA).strftime("%d/%m/%Y")
        fim = janela.fim.astimezone(BRASILIA).strftime("%d/%m/%Y")
        urls = [
            f"{PRESENCAS}?dataIni={inicio}&dataFim={fim}&numMatriculaParlamentar={matricula}"
            for matricula in sorted({m for m, _ in self._matriculas(deputados)})
        ]
        with ThreadPoolExecutor(max_workers=self._consultas_simultaneas) as executor:
            for resposta in executor.map(self._buscar, urls):
                # 404: o serviço não tem frequência da matrícula no período. Falta de dado não é
                # ausência do deputado, então nada é gravado.
                if resposta is not None:
                    yield resposta

    def validar(self, resposta: RespostaBruta) -> None:
        if _eh_frequencia(resposta.url):
            self._dias(resposta)
        else:
            self._matriculas(resposta)

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        if not _eh_frequencia(resposta.url):
            for matricula, id_deputado in self._matriculas(resposta):
                yield RegistroPrata(
                    tabela="camara_matricula",
                    chave_natural=("matricula",),
                    dados={"matricula": matricula, "id_deputado": id_deputado},
                    origem=origem,
                )
            return
        matricula = _matricula_consultada(resposta.url)
        for dia in self._dias(resposta):
            yield RegistroPrata(
                tabela="camara_frequencia_dia",
                chave_natural=("matricula", "dia"),
                dados={"matricula": matricula, **dia},
                origem=origem,
            )

    def _buscar(self, url: str) -> RespostaBruta | None:
        resposta = self._cliente.obter(url)
        if resposta.status == 404:
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

    def _matriculas(self, resposta: RespostaBruta) -> list[tuple[int, int]]:
        raiz = _xml(resposta, "deputados")
        pares = [
            (
                _inteiro(deputado, "matricula", resposta.url),
                _inteiro(deputado, "ideCadastro", resposta.url),
            )
            for deputado in raiz.findall("deputado")
        ]
        if not pares:
            raise FonteMudouDeFormatoError(f"Nenhum deputado em {resposta.url}")
        return pares

    def _dias(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        raiz = _xml(resposta, "parlamentar")
        matricula = _inteiro(raiz, "carteiraParlamentar", resposta.url)
        if matricula != _matricula_consultada(resposta.url):
            raise FonteMudouDeFormatoError(
                f"Frequência de outra matrícula ({matricula}) em {resposta.url}"
            )
        dias = raiz.find("diasDeSessoes2")
        if dias is None:
            raise FonteMudouDeFormatoError(f"Resposta sem 'diasDeSessoes2' em {resposta.url}")
        return [_dia(elemento, resposta.url) for elemento in dias.findall("dia")]


def _dia(elemento: Element, url: str) -> dict[str, Any]:
    texto = _texto(elemento, "data", url)
    try:
        dia = datetime.strptime(texto, "%d/%m/%Y %H:%M:%S").replace(tzinfo=BRASILIA).date()
    except ValueError as erro:
        raise FonteMudouDeFormatoError(f"Data {texto!r} fora do formato em {url}") from erro
    sessoes = elemento.find("sessoes")
    if sessoes is None:
        raise FonteMudouDeFormatoError(f"Dia sem 'sessoes' em {url}")
    return {
        "dia": dia,
        "frequencia": _frequencia(elemento, "frequencianoDia", url),
        "justificativa": " ".join((elemento.findtext("justificativa") or "").split()) or None,
        "sessoes": [
            {
                "descricao": " ".join(_texto(sessao, "descricao", url).split()),
                "frequencia": _frequencia(sessao, "frequencia", url),
            }
            for sessao in sessoes.findall("sessao")
        ],
    }


def _frequencia(elemento: Element, campo: str, url: str) -> str:
    valor = _texto(elemento, campo, url)
    if valor not in FREQUENCIAS:
        raise FonteMudouDeFormatoError(f"Frequência desconhecida {valor!r} em {url}")
    return valor


def _xml(resposta: RespostaBruta, raiz_esperada: str) -> Element:
    try:
        raiz: Element = fromstring(resposta.conteudo)
    except (ParseError, DefusedXmlException) as erro:
        raise FonteMudouDeFormatoError(f"Resposta não é XML válido em {resposta.url}") from erro
    if raiz.tag != raiz_esperada:
        raise FonteMudouDeFormatoError(
            f"Raiz {raiz.tag!r} em vez de {raiz_esperada!r} em {resposta.url}"
        )
    return raiz


def _texto(elemento: Element, campo: str, url: str) -> str:
    valor = (elemento.findtext(campo) or "").strip()
    if not valor:
        raise FonteMudouDeFormatoError(f"Campo {campo!r} ausente ou vazio em {url}")
    return valor


def _inteiro(elemento: Element, campo: str, url: str) -> int:
    texto = _texto(elemento, campo, url)
    if not texto.isdigit():
        raise FonteMudouDeFormatoError(f"Campo {campo!r} não é um número em {url}")
    return int(texto)


def _matricula_consultada(url: str) -> int:
    return int(parse_qs(urlsplit(url).query)["numMatriculaParlamentar"][0])


def _eh_frequencia(url: str) -> bool:
    return urlsplit(url).path.endswith("/ListarPresencasParlamentar")
