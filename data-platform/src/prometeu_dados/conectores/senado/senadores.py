"""Senadores da legislatura atual e da anterior, e os períodos em que exerceram mandato.

Produz as tabelas prata `senado_senador` e `senado_exercicios`, descritas em
`packages/contracts/prata/senado/`. Como na Câmara, a lista de quem está em exercício não basta: o
suplente que assumiu por alguns meses vota, e some da lista quando o titular volta. O conector
percorre todos os senadores da legislatura e lê os mandatos de cada um, que trazem os exercícios
(início, fim e a causa do afastamento).

A legislatura anterior entra porque o primeiro orçamento de cada legislatura é emendado pela que
termina: os autores das emendas ao orçamento de 2023 são os senadores de 2019 a 2023.

A API do Senado recusa conexões quando recebe muitas consultas ao mesmo tempo; as consultas vão uma
de cada vez (menos de um minuto no total, com a conexão reaproveitada).
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.senado import _json as j
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

API = "https://legis.senado.leg.br/dadosabertos"
SIGLAS_UF = frozenset(
    {
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
        "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
    }
)  # fmt: skip

BRASILIA = timezone(timedelta(hours=-3))


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorSenadoresDoSenado:
    nome = "senado"
    versao_do_contrato = "1.1.0"

    def __init__(
        self,
        cliente: ClienteHttp,
        relogio: Callable[[], datetime] = _agora,
        legislaturas_anteriores: int = 1,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._legislaturas_anteriores = legislaturas_anteriores

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """Acha a legislatura do fim da janela e as anteriores, lê os mandatos de cada senador
        delas e, de quem exerceu mandato no período que elas cobrem, o detalhe com nome, partido e
        foto. Quem esteve nas duas legislaturas é lido uma vez."""
        dia = janela.fim.astimezone(BRASILIA).date()
        atual = self._buscar(f"{API}/senador/lista/atual")
        yield atual
        legislaturas = self._legislaturas_ate(atual, dia)
        inicio, fim = legislaturas[0][1], legislaturas[-1][2]

        codigos: set[int] = set()
        for numero, _, _ in legislaturas:
            lista = self._buscar(f"{API}/senador/lista/legislatura/{numero}")
            yield lista
            codigos.update(self._codigos(lista))
        for codigo in sorted(codigos):
            mandatos = self._buscar(f"{API}/senador/{codigo}/mandatos")
            yield mandatos
            exercicios = self._exercicios(mandatos)
            if any(_toca(e, inicio, fim) for e in exercicios):
                yield self._buscar(f"{API}/senador/{codigo}")

    def validar(self, resposta: RespostaBruta) -> None:
        tipo = _tipo(resposta.url)
        if tipo == "mandatos":
            self._exercicios(resposta)
        elif tipo == "detalhe":
            self._senador(resposta)
        elif tipo == "legislatura":
            self._codigos(resposta)
        else:
            self._legislaturas(resposta)

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        tipo = _tipo(resposta.url)
        if tipo == "mandatos":
            exercicios = self._exercicios(resposta)
            if exercicios:
                yield RegistroPrata(
                    tabela="senado_exercicios",
                    chave_natural=("codigo",),
                    dados={"codigo": _codigo_na_url(resposta.url), "exercicios": exercicios},
                    origem=origem,
                )
        elif tipo == "detalhe":
            yield RegistroPrata(
                tabela="senado_senador",
                chave_natural=("codigo",),
                dados=self._senador(resposta),
                origem=origem,
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

    def _legislaturas(self, resposta: RespostaBruta) -> list[tuple[int, date, date]]:
        """Legislaturas citadas nos mandatos de quem está em exercício. A atual está entre elas, e
        também a anterior: o mandato de senador cobre duas legislaturas, e quem foi eleito na
        eleição anterior está na segunda."""
        parlamentares = j.lista(
            j.caminho(
                j.corpo(resposta),
                resposta.url,
                "ListaParlamentarEmExercicio",
                "Parlamentares",
                "Parlamentar",
            )
        )
        if not parlamentares:
            raise FonteMudouDeFormatoError(f"Nenhum senador em exercício em {resposta.url}")
        legislaturas = set()
        for parlamentar in parlamentares:
            mandato = j.caminho(parlamentar, resposta.url, "Mandato")
            for chave in ("PrimeiraLegislaturaDoMandato", "SegundaLegislaturaDoMandato"):
                legislatura = j.caminho(mandato, resposta.url, chave)
                legislaturas.add(
                    (
                        j.inteiro(legislatura, "NumeroLegislatura", resposta.url),
                        j.dia(legislatura, "DataInicio", resposta.url),
                        j.dia(legislatura, "DataFim", resposta.url),
                    )
                )
        return sorted(legislaturas)

    def _legislaturas_ate(self, resposta: RespostaBruta, dia: date) -> list[tuple[int, date, date]]:
        """A legislatura em curso no dia e as anteriores a coletar, da mais antiga para a atual."""
        conhecidas = {
            numero: (numero, inicio, fim) for numero, inicio, fim in self._legislaturas(resposta)
        }
        em_curso = next((n for n, i, f in conhecidas.values() if i <= dia <= f), None)
        if em_curso is None:
            raise FonteMudouDeFormatoError(
                f"Nenhuma legislatura em curso em {dia} em {resposta.url}"
            )
        numeros = range(em_curso - self._legislaturas_anteriores, em_curso + 1)
        faltando = [n for n in numeros if n not in conhecidas]
        if faltando:
            raise FonteMudouDeFormatoError(
                f"Legislaturas {faltando} não aparecem nos mandatos em {resposta.url}"
            )
        return [conhecidas[n] for n in numeros]

    def _codigos(self, resposta: RespostaBruta) -> list[int]:
        parlamentares = j.lista(
            j.caminho(
                j.corpo(resposta),
                resposta.url,
                "ListaParlamentarLegislatura",
                "Parlamentares",
                "Parlamentar",
            )
        )
        if not parlamentares:
            raise FonteMudouDeFormatoError(f"Nenhum senador em {resposta.url}")
        codigos = {
            j.inteiro(
                j.caminho(p, resposta.url, "IdentificacaoParlamentar"),
                "CodigoParlamentar",
                resposta.url,
            )
            for p in parlamentares
        }
        return sorted(codigos)

    def _exercicios(self, resposta: RespostaBruta) -> list[dict[str, Any]]:
        """Todos os exercícios de todos os mandatos, em ordem de início, com a UF do mandato e o fim
        do mandato (que limita o exercício em curso)."""
        parlamentar = j.caminho(
            j.corpo(resposta), resposta.url, "MandatoParlamentar", "Parlamentar"
        )
        exercicios = []
        mandatos = parlamentar.get("Mandatos") if isinstance(parlamentar, dict) else None
        for mandato in j.lista(mandatos.get("Mandato") if isinstance(mandatos, dict) else None):
            uf = j.texto(mandato, "UfParlamentar", resposta.url)
            if uf not in SIGLAS_UF:
                raise FonteMudouDeFormatoError(f"UF desconhecida {uf!r} em {resposta.url}")
            ultima = mandato.get("SegundaLegislaturaDoMandato") or j.caminho(
                mandato, resposta.url, "PrimeiraLegislaturaDoMandato"
            )
            fim_do_mandato = j.dia(ultima, "DataFim", resposta.url)
            registrados = mandato.get("Exercicios")
            for exercicio in j.lista(
                registrados.get("Exercicio") if isinstance(registrados, dict) else None
            ):
                inicio = j.dia(exercicio, "DataInicio", resposta.url)
                fim = (
                    j.dia(exercicio, "DataFim", resposta.url) if exercicio.get("DataFim") else None
                )
                if fim is not None and fim < inicio:
                    raise FonteMudouDeFormatoError(
                        f"Exercício termina antes de começar em {resposta.url}"
                    )
                exercicios.append(
                    {
                        "codigo_exercicio": j.inteiro(exercicio, "CodigoExercicio", resposta.url),
                        "uf": uf,
                        "inicio": inicio.isoformat(),
                        "fim": None if fim is None else fim.isoformat(),
                        "fim_do_mandato": fim_do_mandato.isoformat(),
                        "causa_do_afastamento": j.texto_opcional(
                            exercicio, "SiglaCausaAfastamento"
                        ),
                    }
                )
        return sorted(exercicios, key=lambda e: (e["inicio"], e["codigo_exercicio"]))

    def _senador(self, resposta: RespostaBruta) -> dict[str, Any]:
        identificacao = j.caminho(
            j.corpo(resposta),
            resposta.url,
            "DetalheParlamentar",
            "Parlamentar",
            "IdentificacaoParlamentar",
        )
        codigo = j.inteiro(identificacao, "CodigoParlamentar", resposta.url)
        if codigo != _codigo_na_url(resposta.url):
            raise FonteMudouDeFormatoError(f"Detalhe de outro senador ({codigo}) em {resposta.url}")
        return {
            "codigo": codigo,
            "nome": j.texto(identificacao, "NomeParlamentar", resposta.url),
            "sigla_partido": j.texto_opcional(identificacao, "SiglaPartidoParlamentar"),
            "url_foto": j.texto_opcional(identificacao, "UrlFotoParlamentar"),
        }


def _toca(exercicio: dict[str, Any], inicio: date, fim: date) -> bool:
    return exercicio["inicio"] <= fim.isoformat() and (
        exercicio["fim"] is None or exercicio["fim"] >= inicio.isoformat()
    )


def _tipo(url: str) -> str:
    """`atual`, `legislatura` (lista da legislatura), `mandatos` ou `detalhe` de um senador."""
    partes = urlsplit(url).path.rstrip("/").split("/")
    if partes[-1] == "mandatos":
        return "mandatos"
    if partes[-2] == "legislatura":
        return "legislatura"
    if partes[-1] == "atual":
        return "atual"
    return "detalhe"


def _codigo_na_url(url: str) -> int:
    partes = urlsplit(url).path.rstrip("/").split("/")
    return int(partes[-2] if partes[-1] == "mandatos" else partes[-1])
