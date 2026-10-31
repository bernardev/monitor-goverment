"""Emendas parlamentares ao orçamento federal: autor, destino, execução, favorecidos e convênios.

Produz as tabelas prata `transparencia_emenda`, `transparencia_emenda_favorecido` e
`transparencia_emenda_convenio`, descritas em `packages/contracts/prata/portal_transparencia/`. A
fonte é o arquivo único de emendas do Portal da Transparência (a API exige cadastro com chave; o
arquivo, não): um ZIP com um CSV para cada tabela, retrato completo atualizado pela CGU.

Entram os orçamentos a partir de `ano_inicial`. Uma emenda pode ter mais de uma linha: uma por
ação orçamentária e localidade de destino.

Pessoas físicas recebem dinheiro de emenda (bolsas, auxílios), e o Portal publica o nome delas.
Aqui elas são somadas por emenda, mês e município, sem nome nem CPF: o Prometeu acompanha o
dinheiro, e dado de cidadão é o mínimo necessário (LGPD, em docs/arquitetura/visao-geral.md). O
mesmo vale para a inscrição genérica, usada para quem não tem CPF nem CNPJ, que mistura pessoas e
empresas estrangeiras.
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from typing import Any

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

ARQUIVO = "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO"
CSV_DAS_EMENDAS = "EmendasParlamentares.csv"
CSV_DOS_FAVORECIDOS = "EmendasParlamentares_PorFavorecido.csv"
CSV_DOS_CONVENIOS = "EmendasParlamentares_Convenios.csv"

COLUNAS = (
    "Código da Emenda",
    "Ano da Emenda",
    "Tipo de Emenda",
    "Código do Autor da Emenda",
    "Nome do Autor da Emenda",
    "Número da emenda",
    "Localidade de aplicação do recurso",
    "Código Município IBGE",
    "Município",
    "Código UF IBGE",
    "UF",
    "Região",
    "Código Função",
    "Nome Função",
    "Código Subfunção",
    "Nome Subfunção",
    "Código Programa",
    "Nome Programa",
    "Código Ação",
    "Nome Ação",
    "Código Plano Orçamentário",
    "Nome Plano Orçamentário",
    "Valor Empenhado",
    "Valor Liquidado",
    "Valor Pago",
    "Valor Restos A Pagar Inscritos",
    "Valor Restos A Pagar Cancelados",
    "Valor Restos A Pagar Pagos",
)
"""Cabeçalho do CSV das emendas, na ordem. Outro cabeçalho faz o conector falhar."""

COLUNAS_DOS_FAVORECIDOS = (
    "Código da Emenda",
    "Código do Autor da Emenda",
    "Nome do Autor da Emenda",
    "Número da emenda",
    "Tipo de Emenda",
    "Ano/Mês",
    "Código do Favorecido",
    "Favorecido",
    "Natureza Jurídica",
    "Tipo Favorecido",
    "UF Favorecido",
    "Município Favorecido",
    "Valor Recebido",
)

COLUNAS_DOS_CONVENIOS = (
    "Código da Emenda",
    "Código Função",
    "Nome Função",
    "Código Subfunção",
    "Nome Subfunção",
    "Localidade do gasto",
    "Tipo de Emenda",
    "Data Publicação Convênio",
    "Convenente",
    "Objeto Convênio",
    "Número Convênio",
    "Valor Convênio",
)

TIPOS = frozenset(
    {
        "Emenda Individual - Transferências com Finalidade Definida",
        "Emenda Individual - Transferências Especiais",
        "Emenda de Bancada",
        "Emenda de Comissão",
        "Emenda de Relator",
    }
)

IDENTIFICADOS = {
    "Pessoa Jurídica": re.compile(r"^\d{14}$"),
    "Unidade Gestora": re.compile(r"^\d{6}$"),
}
"""Favorecidos que entram com nome e documento: o CNPJ, ou o código SIAFI da unidade gestora."""

SOMADOS = {
    "Pessoa Fisica": "Pessoa Física",
    "Inscrição Genérica": "Inscrição Genérica",
    # O Portal corta a grafia em parte das linhas.
    "Inscrição Genéric": "Inscrição Genérica",
    "Sem informação": "Sem informação",
}
"""Favorecidos somados por emenda, mês e município, sem nome nem documento; grafia corrigida."""

SIGLAS_UF = frozenset(
    {
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
        "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
    }
)  # fmt: skip

SEM_INFORMACAO = "Sem informação"
VALOR = re.compile(r"^(-?)(\d+),(\d{2})$")
CODIGO_IBGE = re.compile(r"^\d{7}$")
MES = re.compile(r"^(\d{4})(0[1-9]|1[0-2])$")
DATA = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")
NUMERO_DO_CONVENIO = re.compile(r"^[0-9A-Z]+$")

CHAVE_DA_EMENDA = (
    "codigo_emenda",
    "localidade",
    "codigo_funcao",
    "codigo_subfuncao",
    "codigo_programa",
    "codigo_acao",
    "codigo_plano_orcamentario",
)
CHAVE_DO_FAVORECIDO = (
    "codigo_emenda",
    "mes",
    "tipo_favorecido",
    "codigo_favorecido",
    "uf",
    "municipio",
)
CHAVE_DO_CONVENIO = (
    "codigo_emenda",
    "numero_convenio",
    "codigo_funcao",
    "codigo_subfuncao",
    "localidade",
)

Registro = tuple[str, tuple[str, ...], dict[str, Any]]


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorEmendasDoPortal:
    nome = "portal_transparencia"
    versao_do_contrato = "1.1.0"

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
        """O arquivo é um retrato do momento: a janela só registra quando ele foi baixado."""
        resposta = self._cliente.obter(ARQUIVO)
        if resposta.status != 200:
            raise FonteIndisponivelError(f"Portal respondeu {resposta.status} para {ARQUIVO}")
        yield RespostaBruta(
            fonte=self.nome,
            url=ARQUIVO,
            coletado_em=self._relogio(),
            conteudo=resposta.conteudo,
            tipo_de_conteudo=resposta.tipo_de_conteudo,
            cabecalhos=dict(resposta.cabecalhos),
        )

    def validar(self, resposta: RespostaBruta) -> None:
        for _ in self._registros(resposta):
            pass

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        for tabela, chave, dados in self._registros(resposta):
            yield RegistroPrata(tabela=tabela, chave_natural=chave, dados=dados, origem=origem)

    def _registros(self, resposta: RespostaBruta) -> Iterator[Registro]:
        url = resposta.url
        try:
            arquivo = zipfile.ZipFile(io.BytesIO(resposta.conteudo))
        except zipfile.BadZipFile as erro:
            raise FonteMudouDeFormatoError(f"{url} não devolveu um ZIP") from erro
        with arquivo:
            for dados in _sem_repetir(self._emendas(arquivo, url), CHAVE_DA_EMENDA, url):
                yield "transparencia_emenda", CHAVE_DA_EMENDA, dados
            for dados in self._favorecidos(arquivo, url):
                yield "transparencia_emenda_favorecido", CHAVE_DO_FAVORECIDO, dados
            for dados in _sem_repetir(self._convenios(arquivo, url), CHAVE_DO_CONVENIO, url):
                yield "transparencia_emenda_convenio", CHAVE_DO_CONVENIO, dados

    def _emendas(self, arquivo: zipfile.ZipFile, url: str) -> Iterator[dict[str, Any]]:
        for numero, campos in _csv(arquivo, CSV_DAS_EMENDAS, COLUNAS, url):
            ano = _inteiro(campos["Ano da Emenda"], numero, url)
            # Emendas antigas vêm sem código; a partir do orçamento de 2021 todas têm.
            if ano < self._ano_inicial or campos["Código da Emenda"] == SEM_INFORMACAO:
                continue
            yield _emenda(campos, ano, numero, url)

    def _favorecidos(self, arquivo: zipfile.ZipFile, url: str) -> Iterator[dict[str, Any]]:
        """Os identificados saem na ordem do arquivo; os somados, no fim, na ordem da chave."""
        somados: dict[tuple[Any, ...], dict[str, Any]] = {}
        identificados: set[tuple[Any, ...]] = set()
        for numero, campos in _csv(arquivo, CSV_DOS_FAVORECIDOS, COLUNAS_DOS_FAVORECIDOS, url):
            codigo = self._codigo_no_periodo(campos, numero, url)
            if codigo is None:
                continue
            dados = _favorecido(codigo, campos, numero, url)
            chave = tuple(dados[c] for c in CHAVE_DO_FAVORECIDO)
            if dados["codigo_favorecido"] is None:
                soma = somados.setdefault(chave, {**dados, "quantidade": 0, "valor_centavos": 0})
                soma["quantidade"] += 1
                soma["valor_centavos"] += dados["valor_centavos"]
                continue
            if chave in identificados:
                raise FonteMudouDeFormatoError(
                    f"Linha {numero} repete o favorecido no mês em {CSV_DOS_FAVORECIDOS} de {url}"
                )
            identificados.add(chave)
            yield dados
        for chave in sorted(somados, key=_ordem_com_nulos):
            yield somados[chave]

    def _convenios(self, arquivo: zipfile.ZipFile, url: str) -> Iterator[dict[str, Any]]:
        for numero, campos in _csv(arquivo, CSV_DOS_CONVENIOS, COLUNAS_DOS_CONVENIOS, url):
            codigo = self._codigo_no_periodo(campos, numero, url)
            if codigo is not None:
                yield _convenio(codigo, campos, numero, url)

    def _codigo_no_periodo(self, campos: dict[str, str], numero: int, url: str) -> str | None:
        """O código da emenda, se ela é de orçamento coletado. O código começa pelo ano."""
        codigo = campos["Código da Emenda"]
        if codigo == SEM_INFORMACAO:
            return None
        if not codigo.isdigit() or len(codigo) < 5:
            raise FonteMudouDeFormatoError(
                f"Código de emenda {codigo!r} na linha {numero} de {url}"
            )
        return codigo if int(codigo[:4]) >= self._ano_inicial else None


def _csv(
    arquivo: zipfile.ZipFile, nome: str, colunas: tuple[str, ...], url: str
) -> Iterator[tuple[int, dict[str, str]]]:
    """Linhas do CSV (Latin-1, separado por `;`), com o número da linha no arquivo."""
    try:
        bruto = arquivo.open(nome)
    except KeyError as erro:
        raise FonteMudouDeFormatoError(f"{nome} não está no arquivo de {url}") from erro
    with io.TextIOWrapper(bruto, encoding="latin-1", newline="") as texto:
        leitor = csv.reader(texto, delimiter=";")
        if tuple(next(leitor, ())) != colunas:
            raise FonteMudouDeFormatoError(f"Cabeçalho inesperado em {nome} de {url}")
        for numero, linha in enumerate(leitor, start=2):
            if len(linha) != len(colunas):
                raise FonteMudouDeFormatoError(
                    f"Linha {numero} com {len(linha)} colunas em {nome} de {url}"
                )
            yield numero, dict(zip(colunas, linha, strict=True))


def _sem_repetir(
    registros: Iterator[dict[str, Any]], chave: tuple[str, ...], url: str
) -> Iterator[dict[str, Any]]:
    vistas: set[tuple[Any, ...]] = set()
    for dados in registros:
        valor = tuple(dados[c] for c in chave)
        if valor in vistas:
            raise FonteMudouDeFormatoError(f"Registro repetido {valor} em {url}")
        vistas.add(valor)
        yield dados


def _ordem_com_nulos(chave: tuple[Any, ...]) -> tuple[tuple[bool, Any], ...]:
    return tuple((valor is not None, valor or "") for valor in chave)


def _emenda(campos: dict[str, str], ano: int, numero: int, url: str) -> dict[str, Any]:
    codigo = campos["Código da Emenda"]
    if not codigo.isdigit():
        raise FonteMudouDeFormatoError(f"Código de emenda {codigo!r} na linha {numero} de {url}")
    return {
        "codigo_emenda": codigo,
        "ano": ano,
        "tipo": _tipo(campos, numero, url),
        "codigo_autor": _texto(campos["Código do Autor da Emenda"]),
        "nome_autor": _texto(campos["Nome do Autor da Emenda"]),
        "numero_emenda": _texto(campos["Número da emenda"]),
        "localidade": _texto(campos["Localidade de aplicação do recurso"]) or SEM_INFORMACAO,
        "codigo_municipio_ibge": _ibge(campos["Código Município IBGE"]),
        "codigo_uf_ibge": _ibge(campos["Código UF IBGE"]),
        "codigo_funcao": campos["Código Função"],
        "nome_funcao": _texto(campos["Nome Função"]),
        "codigo_subfuncao": campos["Código Subfunção"],
        "nome_subfuncao": _texto(campos["Nome Subfunção"]),
        "codigo_programa": campos["Código Programa"],
        "nome_programa": _texto(campos["Nome Programa"]),
        "codigo_acao": campos["Código Ação"],
        "nome_acao": _texto(campos["Nome Ação"]),
        "codigo_plano_orcamentario": campos["Código Plano Orçamentário"],
        "nome_plano_orcamentario": _texto(campos["Nome Plano Orçamentário"]),
        "empenhado_centavos": _centavos(campos["Valor Empenhado"], numero, url),
        "liquidado_centavos": _centavos(campos["Valor Liquidado"], numero, url),
        "pago_centavos": _centavos(campos["Valor Pago"], numero, url),
        "restos_inscritos_centavos": _centavos(
            campos["Valor Restos A Pagar Inscritos"], numero, url
        ),
        "restos_cancelados_centavos": _centavos(
            campos["Valor Restos A Pagar Cancelados"], numero, url
        ),
        "restos_pagos_centavos": _centavos(campos["Valor Restos A Pagar Pagos"], numero, url),
    }


def _favorecido(codigo: str, campos: dict[str, str], numero: int, url: str) -> dict[str, Any]:
    """Um recebimento num mês. O somado sai sem documento, nome nem natureza jurídica."""
    _tipo(campos, numero, url)
    tipo = campos["Tipo Favorecido"]
    documento = IDENTIFICADOS.get(tipo)
    if documento is None and tipo not in SOMADOS:
        raise FonteMudouDeFormatoError(f"Tipo de favorecido {tipo!r} na linha {numero} de {url}")
    if documento is not None and not documento.match(campos["Código do Favorecido"]):
        raise FonteMudouDeFormatoError(
            f"Documento de {tipo} fora do formato na linha {numero} de {url}"
        )
    mes = MES.match(campos["Ano/Mês"])
    if mes is None:
        raise FonteMudouDeFormatoError(
            f"Mês {campos['Ano/Mês']!r} fora do formato na linha {numero} de {url}"
        )
    uf: str | None = campos["UF Favorecido"]
    if uf in ("", "-1"):
        uf = None
    elif uf not in SIGLAS_UF:
        raise FonteMudouDeFormatoError(f"UF {uf!r} na linha {numero} de {url}")
    identificado = documento is not None
    return {
        "codigo_emenda": codigo,
        "mes": f"{mes.group(1)}-{mes.group(2)}",
        "tipo_favorecido": tipo if identificado else SOMADOS[tipo],
        "codigo_favorecido": campos["Código do Favorecido"] if identificado else None,
        "nome_favorecido": _texto(campos["Favorecido"]) if identificado else None,
        "natureza_juridica": _informado(campos["Natureza Jurídica"]) if identificado else None,
        "uf": uf,
        "municipio": _informado(campos["Município Favorecido"]),
        "quantidade": 1,
        "valor_centavos": _centavos(campos["Valor Recebido"], numero, url),
    }


def _convenio(codigo: str, campos: dict[str, str], numero: int, url: str) -> dict[str, Any]:
    _tipo(campos, numero, url)
    convenio = campos["Número Convênio"]
    if not NUMERO_DO_CONVENIO.match(convenio):
        raise FonteMudouDeFormatoError(f"Convênio {convenio!r} na linha {numero} de {url}")
    convenente = _texto(campos["Convenente"])
    if not convenente:
        raise FonteMudouDeFormatoError(f"Convênio sem convenente na linha {numero} de {url}")
    valor = _centavos(campos["Valor Convênio"], numero, url)
    if valor < 0:
        raise FonteMudouDeFormatoError(f"Convênio de valor negativo na linha {numero} de {url}")
    return {
        "codigo_emenda": codigo,
        "numero_convenio": convenio,
        "codigo_funcao": campos["Código Função"],
        "nome_funcao": _texto(campos["Nome Função"]),
        "codigo_subfuncao": campos["Código Subfunção"],
        "nome_subfuncao": _texto(campos["Nome Subfunção"]),
        "localidade": _texto(campos["Localidade do gasto"]) or SEM_INFORMACAO,
        "publicado_em": _data(campos["Data Publicação Convênio"], numero, url).isoformat(),
        "convenente": convenente,
        "objeto": _texto(campos["Objeto Convênio"]) or None,
        "valor_centavos": valor,
    }


def _tipo(campos: dict[str, str], numero: int, url: str) -> str:
    tipo = campos["Tipo de Emenda"]
    if tipo not in TIPOS:
        raise FonteMudouDeFormatoError(f"Tipo de emenda {tipo!r} na linha {numero} de {url}")
    return tipo


def _texto(valor: str) -> str:
    return " ".join(valor.split())


def _informado(valor: str) -> str | None:
    """Texto da fonte; vazio e `Sem informação` são nulo."""
    texto = _texto(valor)
    return None if texto in ("", SEM_INFORMACAO) else texto


def _ibge(valor: str) -> str | None:
    """Código IBGE de sete dígitos; `Sem informação`, `-1` e `-14` (múltiplo, nacional) são nulo."""
    return valor if CODIGO_IBGE.match(valor) else None


def _inteiro(valor: str, numero: int, url: str) -> int:
    if not valor.isdigit():
        raise FonteMudouDeFormatoError(f"Número {valor!r} na linha {numero} de {url}")
    return int(valor)


def _data(valor: str, numero: int, url: str) -> date:
    """`06/01/2016` vira 2016-01-06."""
    partes = DATA.match(valor)
    try:
        if partes is None:
            raise ValueError(valor)
        dia, mes, ano = partes.groups()
        return date(int(ano), int(mes), int(dia))
    except ValueError as erro:
        raise FonteMudouDeFormatoError(
            f"Data {valor!r} fora do formato na linha {numero} de {url}"
        ) from erro


def _centavos(valor: str, numero: int, url: str) -> int:
    """`1234567,89` vira 123456789 centavos. Nunca ponto flutuante."""
    partes = VALOR.match(valor)
    if partes is None:
        raise FonteMudouDeFormatoError(
            f"Valor {valor!r} fora do formato na linha {numero} de {url}"
        )
    sinal, reais, centavos = partes.groups()
    total = int(reais) * 100 + int(centavos)
    return -total if sinal else total
