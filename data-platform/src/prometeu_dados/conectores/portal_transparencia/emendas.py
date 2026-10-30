"""Emendas parlamentares ao orçamento federal: autor, destino, ação orçamentária e execução.

Produz a tabela prata `transparencia_emenda`, descrita em
`packages/contracts/prata/portal_transparencia/`. A fonte é o arquivo único de emendas do Portal da
Transparência (a API exige cadastro com chave; o arquivo, não). É um retrato completo, atualizado
pela CGU, com os valores acumulados de empenho, liquidação e pagamento de cada emenda.

Entram os orçamentos a partir de `ano_inicial`. Uma emenda pode ter mais de uma linha: uma por
ação orçamentária e localidade de destino.
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from typing import Any

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores.base import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.prata import Origem, RegistroPrata
from prometeu_dados.rede import ClienteHttp, FonteIndisponivelError

ARQUIVO = "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO"
CSV_DAS_EMENDAS = "EmendasParlamentares.csv"

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
"""Cabeçalho do CSV, na ordem. Outro cabeçalho faz o conector falhar."""

TIPOS = frozenset(
    {
        "Emenda Individual - Transferências com Finalidade Definida",
        "Emenda Individual - Transferências Especiais",
        "Emenda de Bancada",
        "Emenda de Comissão",
        "Emenda de Relator",
    }
)

SEM_INFORMACAO = "Sem informação"
VALOR = re.compile(r"^(-?)(\d+),(\d{2})$")
CODIGO_IBGE = re.compile(r"^\d{7}$")


def _agora() -> datetime:
    return datetime.now(UTC)


class ConectorEmendasDoPortal:
    nome = "portal_transparencia"
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
        for _ in self._linhas(resposta):
            pass

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        origem = Origem.da_resposta(resposta)
        for dados in self._linhas(resposta):
            yield RegistroPrata(
                tabela="transparencia_emenda",
                chave_natural=(
                    "codigo_emenda",
                    "localidade",
                    "codigo_funcao",
                    "codigo_subfuncao",
                    "codigo_programa",
                    "codigo_acao",
                    "codigo_plano_orcamentario",
                ),
                dados=dados,
                origem=origem,
            )

    def _linhas(self, resposta: RespostaBruta) -> Iterator[dict[str, Any]]:
        url = resposta.url
        try:
            with zipfile.ZipFile(io.BytesIO(resposta.conteudo)) as arquivo:
                bruto = arquivo.read(CSV_DAS_EMENDAS)
        except (zipfile.BadZipFile, KeyError) as erro:
            raise FonteMudouDeFormatoError(
                f"{CSV_DAS_EMENDAS} não está no arquivo de {url}"
            ) from erro
        leitor = csv.reader(io.StringIO(bruto.decode("latin-1")), delimiter=";")
        cabecalho = tuple(next(leitor, ()))
        if cabecalho != COLUNAS:
            raise FonteMudouDeFormatoError(f"Cabeçalho inesperado em {CSV_DAS_EMENDAS} de {url}")
        vistas: set[tuple[Any, ...]] = set()
        for numero, linha in enumerate(leitor, start=2):
            if len(linha) != len(COLUNAS):
                raise FonteMudouDeFormatoError(f"Linha {numero} com {len(linha)} colunas em {url}")
            campos = dict(zip(COLUNAS, linha, strict=True))
            ano = _inteiro(campos["Ano da Emenda"], numero, url)
            # Emendas antigas vêm sem código; a partir do orçamento de 2021 todas têm.
            if ano < self._ano_inicial or campos["Código da Emenda"] == SEM_INFORMACAO:
                continue
            dados = _emenda(campos, ano, numero, url)
            chave = (
                dados["codigo_emenda"],
                dados["localidade"],
                dados["codigo_funcao"],
                dados["codigo_subfuncao"],
                dados["codigo_programa"],
                dados["codigo_acao"],
                dados["codigo_plano_orcamentario"],
            )
            if chave in vistas:
                raise FonteMudouDeFormatoError(f"Linha {numero} repete uma destinação em {url}")
            vistas.add(chave)
            yield dados


def _emenda(campos: dict[str, str], ano: int, numero: int, url: str) -> dict[str, Any]:
    codigo = campos["Código da Emenda"]
    if not codigo.isdigit():
        raise FonteMudouDeFormatoError(f"Código de emenda {codigo!r} na linha {numero} de {url}")
    tipo = campos["Tipo de Emenda"]
    if tipo not in TIPOS:
        raise FonteMudouDeFormatoError(f"Tipo de emenda {tipo!r} na linha {numero} de {url}")
    return {
        "codigo_emenda": codigo,
        "ano": ano,
        "tipo": tipo,
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


def _texto(valor: str) -> str:
    return " ".join(valor.split())


def _ibge(valor: str) -> str | None:
    """Código IBGE de sete dígitos; `Sem informação`, `-1` e `-14` (múltiplo, nacional) são nulo."""
    return valor if CODIGO_IBGE.match(valor) else None


def _inteiro(valor: str, numero: int, url: str) -> int:
    if not valor.isdigit():
        raise FonteMudouDeFormatoError(f"Número {valor!r} na linha {numero} de {url}")
    return int(valor)


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
