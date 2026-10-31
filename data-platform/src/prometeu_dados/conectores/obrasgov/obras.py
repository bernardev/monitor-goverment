"""Obras pagas com emendas parlamentares: situação, execução física, paralisações e localização.

Produz as tabelas prata `obrasgov_empenho_de_emenda`, `obrasgov_projeto`,
`obrasgov_execucao_fisica`, `obrasgov_situacao` e `obrasgov_localizacao`, descritas em
`packages/contracts/prata/obrasgov/`. A fonte é a API pública do Obrasgov.br, o cadastro federal de
projetos de investimento (obras e projetos), sem chave.

A ligação com a emenda está no empenho: parte dos empenhos de cada obra traz, no campo do autor
da emenda, o código completo da emenda no Portal da Transparência (`202360110003`, às vezes escrito
como número decimal: `202360110003.0`). O conector percorre todos os empenhos e busca, um a um, só
os projetos ligados a emendas de orçamentos a partir de `ano_inicial` (o cadastro inteiro tem mais
de 150 mil projetos, e cada página dele custa segundos). Execução física, histórico de paralisação e
localização vêm inteiros, por página: são leves, e o importador escolhe as linhas das obras ligadas.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qs, quote, urlsplit

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

API = "https://api-publica.obrasgov.gestao.gov.br/obras"
POR_PAGINA = 200
"""O máximo que a API aceita."""

EMPENHO = "empenho"
PROJETO = "projeto-investimento"
EXECUCAO = "execucao-fisica"
HISTORICO = "historico-situacao-cancelada-paralisada"
GEOMETRIA = "geometria"
PAGINADOS = (EXECUCAO, HISTORICO, GEOMETRIA)

CODIGO_DE_EMENDA = re.compile(r"^(\d{12})(?:\.0)?$")
ID_DO_PROJETO = re.compile(r"^\d+\.\d{2}-\d{2}$")
CNPJ = re.compile(r"^\d{14}$")
CODIGO_IBGE = re.compile(r"^\d{7}$")
PONTO_WKT = re.compile(r"^POINT ?\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$")
SITUACOES_DO_HISTORICO = frozenset({"Paralisada", "Cancelada", "Inacabada"})
SIGLAS_UF = frozenset(
    {
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
        "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
    }
)  # fmt: skip

TABELAS: dict[str, tuple[str, tuple[str, ...]]] = {
    EMPENHO: (
        "obrasgov_empenho_de_emenda",
        ("id_projeto", "ug_emitente", "numero_empenho", "codigo_emenda"),
    ),
    PROJETO: ("obrasgov_projeto", ("id_projeto",)),
    EXECUCAO: ("obrasgov_execucao_fisica", ("id_execucao",)),
    HISTORICO: ("obrasgov_situacao", ("id_historico",)),
    # A mesma geometria (uma estrada, uma adutora) pode atravessar vários municípios.
    GEOMETRIA: ("obrasgov_localizacao", ("id_geometria", "codigo_municipio_ibge")),
}


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorObrasDoObrasGov:
    nome = "obrasgov"
    versao_do_contrato = "1.0.0"

    def __init__(
        self,
        cliente: ClienteHttp,
        relogio: Callable[[], datetime] = _agora,
        ano_inicial: int = 2023,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._ano_inicial = ano_inicial

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        """O cadastro é um retrato do momento: a janela só registra quando ele foi lido."""
        ligados: set[str] = set()
        for pagina in self._paginas(EMPENHO):
            yield pagina
            ligados.update(e["id_projeto"] for e in self._empenhos(pagina))
        for projeto in sorted(ligados):
            yield self._buscar(f"{API}/{PROJETO}?id_projeto_investimento={quote(projeto)}")
        for recurso in PAGINADOS:
            yield from self._paginas(recurso)

    def validar(self, resposta: RespostaBruta) -> None:
        for _ in self._linhas(resposta):
            pass

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        tabela, chave = TABELAS[_recurso(resposta.url)]
        for dados in self._linhas(resposta):
            yield RegistroPrata(tabela=tabela, chave_natural=chave, dados=dados, origem=origem)

    def _paginas(self, recurso: str) -> Iterator[RespostaBruta]:
        pagina, total = 1, 1
        while pagina <= total:
            resposta = self._buscar(
                f"{API}/{recurso}?pagina={pagina}&tamanho_da_pagina={POR_PAGINA}"
            )
            yield resposta
            total = _inteiro(_corpo(resposta).get("total_pages"), "total_pages", resposta.url)
            pagina += 1

    def _buscar(self, url: str) -> RespostaBruta:
        resposta = self._cliente.obter(url)
        if resposta.status != 200:
            raise FonteIndisponivelError(f"Obrasgov respondeu {resposta.status} para {url}")
        return RespostaBruta(
            fonte=self.nome,
            url=url,
            coletado_em=self._relogio(),
            conteudo=resposta.conteudo,
            tipo_de_conteudo=resposta.tipo_de_conteudo,
            cabecalhos=dict(resposta.cabecalhos),
        )

    def _linhas(self, resposta: RespostaBruta) -> Iterator[dict[str, Any]]:
        recurso = _recurso(resposta.url)
        if recurso == EMPENHO:
            yield from self._empenhos(resposta)
            return
        itens = _itens(resposta)
        if recurso == PROJETO:
            pedido = parse_qs(urlsplit(resposta.url).query).get("id_projeto_investimento", [""])[0]
            if len(itens) != 1 or itens[0].get("id_projeto_investimento") != pedido:
                raise FonteMudouDeFormatoError(f"Esperado só o projeto {pedido} em {resposta.url}")
            yield _projeto(itens[0], resposta.url)
        elif recurso == EXECUCAO:
            yield from (_execucao(item, resposta.url) for item in itens)
        elif recurso == HISTORICO:
            yield from (_historico(item, resposta.url) for item in itens)
        else:
            yield from (_localizacao(item, resposta.url) for item in itens)

    def _empenhos(self, resposta: RespostaBruta) -> Iterator[dict[str, Any]]:
        """Só os empenhos com o código de uma emenda de orçamento coletado: são a ligação."""
        for item in _itens(resposta):
            codigo = CODIGO_DE_EMENDA.match(_texto(item.get("codigo_autor_emenda")) or "")
            if codigo is None or int(codigo.group(1)[:4]) < self._ano_inicial:
                continue
            yield _empenho(item, codigo.group(1), resposta.url)


def _recurso(url: str) -> str:
    recurso = urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1]
    if recurso not in TABELAS:
        raise FonteMudouDeFormatoError(f"Recurso desconhecido em {url}")
    return recurso


def _corpo(resposta: RespostaBruta) -> dict[str, Any]:
    try:
        corpo = json.loads(resposta.conteudo)
    except ValueError as erro:
        raise FonteMudouDeFormatoError(f"{resposta.url} não devolveu JSON") from erro
    if not isinstance(corpo, dict):
        raise FonteMudouDeFormatoError(f"{resposta.url} não devolveu um objeto")
    return corpo


def _itens(resposta: RespostaBruta) -> list[dict[str, Any]]:
    itens = _corpo(resposta).get("data")
    if not isinstance(itens, list) or not all(isinstance(i, dict) for i in itens):
        raise FonteMudouDeFormatoError(f"Resposta sem a lista 'data' em {resposta.url}")
    return itens


def _empenho(item: dict[str, Any], codigo_emenda: str, url: str) -> dict[str, Any]:
    numero = _texto(item.get("nr_empenho"))
    if numero is None:
        raise FonteMudouDeFormatoError(f"Empenho sem número em {url}")
    return {
        "id_projeto": _id_do_projeto(item, url),
        "ug_emitente": str(_inteiro(item.get("ug_emitente"), "ug_emitente", url)),
        "numero_empenho": numero,
        "codigo_emenda": codigo_emenda,
        "acao_orcamentaria": _texto(item.get("acao_orcamentaria")),
        "programa_trabalho": _texto(item.get("programa_trabalho")),
        "plano_interno": _texto(item.get("plano_interno")),
        "valor_empenhado_centavos": _centavos(item.get("valor_empenho"), url, nulo=False),
        "pago_centavos": _centavos(item.get("pago"), url),
        "emitido_em": _data(item.get("data_emissao"), url),
        "descricao": _texto(item.get("descricao_empenho")),
    }


def _projeto(item: dict[str, Any], url: str) -> dict[str, Any]:
    nome = _texto(item.get("desc_nome"))
    situacao = _texto(item.get("situacao"))
    if nome is None or situacao is None:
        raise FonteMudouDeFormatoError(f"Projeto sem nome ou situação em {url}")
    return {
        "id_projeto": _id_do_projeto(item, url),
        "nome": nome,
        "descricao": _texto(item.get("desc_projeto")),
        "natureza": _texto(item.get("natureza_intervencao")),
        "especie": _texto(item.get("especie_intervencao")),
        "situacao": situacao,
        "uf": _uf(item.get("uf_principal"), url),
        "cep": _texto(item.get("nr_cep")),
        "endereco": _texto(item.get("desc_endereco")),
        "inicio_previsto": _data(item.get("dt_inicial_prevista"), url),
        "fim_previsto": _data(item.get("dt_final_prevista"), url),
        "inicio_efetivo": _data(item.get("dt_inicial_efetiva"), url),
        "fim_efetivo": _data(item.get("dt_final_efetiva"), url),
        "cadastrado_em": _data(item.get("dt_cadastro"), url),
        "organizacao_responsavel": _texto(item.get("organizacao_resp")),
        "cnpj_organizacao_responsavel": _cnpj(item.get("cnpj_organizacao_resp"), url),
        "executores": _organizacoes(item.get("executores"), "executor", url),
        "tomadores": _organizacoes(item.get("tomadores"), "tomador", url),
        "repassadores": _organizacoes(item.get("repassadores"), "repassador", url),
        "investimentos_previstos": [
            {
                "fonte": _texto(i.get("desc_nome_fonte_recurso")),
                "valor_centavos": _centavos(i.get("vl_investimento_previsto"), url, nulo=False),
            }
            for i in _lista(item.get("investimentos_previstos"), url)
        ],
        "tipos": [
            {
                "eixo": _texto(t.get("eixo")),
                "tipo": _texto(t.get("tipo")),
                "subtipo": _texto(t.get("subtipo")),
            }
            for t in _lista(item.get("eixos_tipos"), url)
        ],
        "localizacoes": [_ponto(p, url) for p in _lista(item.get("pins"), url)],
        "sistema_responsavel": _texto(item.get("sistema_resp")),
    }


def _execucao(item: dict[str, Any], url: str) -> dict[str, Any]:
    return {
        "id_execucao": _inteiro(item.get("id_execucao_fisica"), "id_execucao_fisica", url),
        "id_projeto": _id_do_projeto(item, url),
        "percentual_centesimos": _centesimos(item.get("percentual_execucao_fisica"), url),
        "inicio": _data(item.get("dt_inicial_execucao"), url),
        "fim": _data(item.get("dt_final_execucao"), url),
        "tipo_instrumento": _texto(item.get("tipo_instrumento")),
        "forma_execucao": _texto(item.get("tipo_forma_execucao")),
        "cadastrada_em": _data(item.get("dt_cadastro_execucao"), url),
        "atualizada_em": _data(item.get("dt_atualizacao_execucao"), url),
        "motivos": sorted(
            {
                motivo
                for m in _lista(item.get("motivos"), url)
                if (motivo := _texto(m.get("descricao_motivo"))) is not None
            }
        ),
    }


def _historico(item: dict[str, Any], url: str) -> dict[str, Any]:
    situacao = _texto(item.get("descricao_historico_situacao_investimento"))
    if situacao not in SITUACOES_DO_HISTORICO:
        raise FonteMudouDeFormatoError(f"Situação {situacao!r} no histórico de {url}")
    data = _data(item.get("data_historico_situacao_investimento"), url)
    if data is None:
        raise FonteMudouDeFormatoError(f"Histórico sem data em {url}")
    tratativas = _texto(item.get("possui_tratativas_situacao_investimento"))
    if tratativas not in (None, "Sim", "Não"):
        raise FonteMudouDeFormatoError(f"Tratativas {tratativas!r} em {url}")
    return {
        "id_historico": _inteiro(
            item.get("id_historico_situacao_investimento"), "id_historico", url
        ),
        "id_projeto": _id_do_projeto(item, url),
        "situacao": situacao,
        "em": data,
        "justificativa": _texto(item.get("justificativa_cancelada_paralisada")),
        "com_tratativas": None if tratativas is None else tratativas == "Sim",
        "fase_das_tratativas": _texto(item.get("fase_tratativas_situacao_investimento")),
    }


def _localizacao(item: dict[str, Any], url: str) -> dict[str, Any]:
    ibge = item.get("cod_ibge")
    codigo = None if ibge is None else str(ibge)
    if codigo is not None and not CODIGO_IBGE.match(codigo):
        raise FonteMudouDeFormatoError(f"Código IBGE {ibge!r} em {url}")
    return {
        "id_geometria": _inteiro(item.get("id_geometria"), "id_geometria", url),
        "id_projeto": _id_do_projeto(item, url),
        "uf": _uf(item.get("sg_uf"), url),
        "municipio": _texto(item.get("no_municipio")),
        "codigo_municipio_ibge": codigo,
        "origem": _texto(item.get("origem_geometria")),
    }


def _id_do_projeto(item: dict[str, Any], url: str) -> str:
    valor = _texto(item.get("id_projeto_investimento"))
    if valor is None or not ID_DO_PROJETO.match(valor):
        raise FonteMudouDeFormatoError(f"Identificador de projeto {valor!r} em {url}")
    return valor


def _organizacoes(valor: object, papel: str, url: str) -> list[dict[str, Any]]:
    return [
        {
            "nome": _texto(o.get(f"organizacao_{papel}")),
            "cnpj": _cnpj(o.get(f"cnpj_{papel}"), url),
        }
        for o in _lista(valor, url)
    ]


def _ponto(pino: dict[str, Any], url: str) -> dict[str, str]:
    """Latitude e longitude como o texto decimal da fonte: nada passa por ponto flutuante.

    Lidas do WKT (`POINT(-35.22 -9.01)`, longitude primeiro). Os campos `latitude` e `longitude` da
    fonte são recortados desse texto e saem quebrados quando falta o espaço depois de `POINT`
    (`9.01025)`).
    """
    texto = _texto(pino.get("pin")) or ""
    partes = PONTO_WKT.match(texto)
    if partes is None:
        raise FonteMudouDeFormatoError(f"Ponto {texto!r} em {url}")
    longitude, latitude = partes.groups()
    if abs(Decimal(latitude)) > 90 or abs(Decimal(longitude)) > 180:
        raise FonteMudouDeFormatoError(f"Ponto fora do globo {texto!r} em {url}")
    return {"latitude": latitude, "longitude": longitude}


def _lista(valor: object, url: str) -> list[dict[str, Any]]:
    if valor is None:
        return []
    if not isinstance(valor, list) or not all(isinstance(v, dict) for v in valor):
        raise FonteMudouDeFormatoError(f"Lista fora do formato em {url}")
    return valor


def _texto(valor: object) -> str | None:
    if valor is None:
        return None
    texto = " ".join(str(valor).split())
    return texto or None


def _uf(valor: object, url: str) -> str | None:
    uf = _texto(valor)
    if uf is not None and uf not in SIGLAS_UF:
        raise FonteMudouDeFormatoError(f"UF {uf!r} em {url}")
    return uf


def _cnpj(valor: object, url: str) -> str | None:
    cnpj = _texto(valor)
    if cnpj is not None and not CNPJ.match(cnpj):
        raise FonteMudouDeFormatoError(f"CNPJ {cnpj!r} em {url}")
    return cnpj


def _inteiro(valor: object, campo: str, url: str) -> int:
    if not isinstance(valor, int) or isinstance(valor, bool):
        raise FonteMudouDeFormatoError(f"{campo} {valor!r} não é inteiro em {url}")
    return valor


def _data(valor: object, url: str) -> str | None:
    """`2025-12-01` ou `2022-08-15T00:00:00`: fica o dia."""
    texto = _texto(valor)
    if texto is None:
        return None
    try:
        return date.fromisoformat(texto[:10]).isoformat()
    except ValueError as erro:
        raise FonteMudouDeFormatoError(f"Data {texto!r} em {url}") from erro


def _decimal(valor: object, url: str) -> Decimal | None:
    if valor is None:
        return None
    if isinstance(valor, bool) or not isinstance(valor, int | float):
        raise FonteMudouDeFormatoError(f"Número {valor!r} em {url}")
    # `repr` do float é o decimal mais curto que o representa: `0.1`, não 0.1000000000000000055.
    return Decimal(repr(valor)) if isinstance(valor, float) else Decimal(valor)


def _centavos(valor: object, url: str, *, nulo: bool = True) -> int | None:
    """Reais da fonte (`481104.0`, `0.01`) em centavos inteiros; mais de duas casas é erro."""
    reais = _decimal(valor, url)
    if reais is None:
        if nulo:
            return None
        raise FonteMudouDeFormatoError(f"Valor ausente em {url}")
    centavos = reais * 100
    if centavos != centavos.to_integral_value() or centavos < 0:
        raise FonteMudouDeFormatoError(f"Valor {valor!r} fora do formato em {url}")
    return int(centavos)


def _centesimos(valor: object, url: str) -> int | None:
    """Percentual com até duas casas (`23.35`) em centésimos de ponto (2335). A fonte tem medição
    acima de 100% (`101.94`); fica como veio, e só o negativo é erro."""
    percentual = _decimal(valor, url)
    if percentual is None:
        return None
    centesimos = percentual * 100
    if centesimos != centesimos.to_integral_value() or centesimos < 0:
        raise FonteMudouDeFormatoError(f"Percentual {valor!r} fora do formato em {url}")
    return int(centesimos)
