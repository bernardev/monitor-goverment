import io
import zipfile
from datetime import UTC, datetime
from typing import Any

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.portal_transparencia import ConectorEmendasDoPortal
from prometeu_dados.conectores.portal_transparencia.emendas import ARQUIVO, COLUNAS
from prometeu_dados.rede import FonteIndisponivelError, RespostaHttp

AGORA = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)
JANELA = JanelaDeColeta(inicio=AGORA, fim=AGORA)

# Linhas no formato do arquivo da CGU, com autores e valores fictícios.
DESTINO_SAUDE = [
    "SÃO PAULO - SP", "3550308", "SÃO PAULO", "3500000", "SÃO PAULO", "Sudeste",
    "10", "Saúde", "302", "Assistência hospitalar e ambulatorial",
    "5118", "ATENÇÃO ESPECIALIZADA À SAÚDE", "2E90", "INCREMENTO TEMPORÁRIO", "0000", "DIVERSAS",
]  # fmt: skip
EMENDA_DA_ANA = [
    "202690010001", "2026", "Emenda Individual - Transferências com Finalidade Definida",
    "9001", "ANA  EXEMPLO", "0001", *DESTINO_SAUDE,
    "1500000,00", "1000000,00", "750000,50", "0,00", "0,00", "0,00",
]  # fmt: skip
SEGUNDA_ACAO_DA_ANA = [
    *EMENDA_DA_ANA[:6], "MÚLTIPLO", "Sem informação", "Sem informação", "-1", "Sem informação",
    "Sem informação", "15", "Urbanismo", "451", "Infraestrutura urbana", "2217", "CIDADES",
    "00SX", "APOIO A OBRAS", "0000", "DIVERSAS",
    "300000,00", "0,00", "0,00", "120000,00", "-5000,00", "0,00",
]  # fmt: skip
EMENDA_DE_BANCADA = [
    "202571060003", "2025", "Emenda de Bancada", "7106", "BANCADA DA BAHIA", "0003",
    "Nacional", "Sem informação", "Sem informação", "-14", "Sem informação", "Sem informação",
    *DESTINO_SAUDE[6:], "200000,00", "0,00", "0,00", "0,00", "0,00", "0,00",
]  # fmt: skip
ANTIGA = ["202233330001", "2022", *EMENDA_DA_ANA[2:]]
SEM_CODIGO = ["Sem informação", "2024", *EMENDA_DA_ANA[2:]]


def arquivo(*linhas: list[str], cabecalho: tuple[str, ...] = COLUNAS) -> bytes:
    texto = io.StringIO()
    for linha in (cabecalho, *linhas):
        texto.write(";".join(f'"{campo}"' for campo in linha) + "\r\n")
    conteudo = io.BytesIO()
    with zipfile.ZipFile(conteudo, "w") as zip_:
        zip_.writestr("EmendasParlamentares.csv", texto.getvalue().encode("latin-1"))
    return conteudo.getvalue()


class Cliente:
    def __init__(self, status: int, conteudo: bytes) -> None:
        self._status = status
        self._conteudo = conteudo

    def obter(self, url: str) -> RespostaHttp:
        return RespostaHttp(url, self._status, self._conteudo, "application/zip")


def registros(conteudo: bytes) -> list[dict[str, Any]]:
    conector = ConectorEmendasDoPortal(Cliente(200, conteudo), relogio=lambda: AGORA)
    return [dict(r.dados) for b in conector.coletar(JANELA) for r in conector.normalizar(b)]


def bruta(conteudo: bytes) -> RespostaBruta:
    return RespostaBruta("portal_transparencia", ARQUIVO, AGORA, conteudo, "application/zip")


def test_uma_linha_por_destinacao_com_valores_em_centavos() -> None:
    ana, outra_acao, bancada = registros(
        arquivo(EMENDA_DA_ANA, SEGUNDA_ACAO_DA_ANA, EMENDA_DE_BANCADA)
    )

    assert ana == {
        "codigo_emenda": "202690010001",
        "ano": 2026,
        "tipo": "Emenda Individual - Transferências com Finalidade Definida",
        "codigo_autor": "9001",
        "nome_autor": "ANA EXEMPLO",
        "numero_emenda": "0001",
        "localidade": "SÃO PAULO - SP",
        "codigo_municipio_ibge": "3550308",
        "codigo_uf_ibge": "3500000",
        "codigo_funcao": "10",
        "nome_funcao": "Saúde",
        "codigo_subfuncao": "302",
        "nome_subfuncao": "Assistência hospitalar e ambulatorial",
        "codigo_programa": "5118",
        "nome_programa": "ATENÇÃO ESPECIALIZADA À SAÚDE",
        "codigo_acao": "2E90",
        "nome_acao": "INCREMENTO TEMPORÁRIO",
        "codigo_plano_orcamentario": "0000",
        "nome_plano_orcamentario": "DIVERSAS",
        "empenhado_centavos": 150_000_000,
        "liquidado_centavos": 100_000_000,
        "pago_centavos": 75_000_050,
        "restos_inscritos_centavos": 0,
        "restos_cancelados_centavos": 0,
        "restos_pagos_centavos": 0,
    }
    assert outra_acao["codigo_emenda"] == ana["codigo_emenda"]
    assert outra_acao["codigo_municipio_ibge"] is None
    assert outra_acao["codigo_uf_ibge"] is None
    assert outra_acao["restos_cancelados_centavos"] == -500_000
    assert bancada["tipo"] == "Emenda de Bancada"
    assert bancada["codigo_uf_ibge"] is None


def test_orcamentos_anteriores_e_linhas_sem_codigo_ficam_de_fora() -> None:
    assert [r["codigo_emenda"] for r in registros(arquivo(ANTIGA, SEM_CODIGO, EMENDA_DA_ANA))] == [
        "202690010001"
    ]


@pytest.mark.parametrize(
    "conteudo",
    [
        b"nao e zip",
        arquivo(cabecalho=COLUNAS[:-1]),
        arquivo([*EMENDA_DA_ANA[:2], "Emenda Secreta", *EMENDA_DA_ANA[3:]]),
        arquivo([*EMENDA_DA_ANA[:-6], "1.500.000,00", *EMENDA_DA_ANA[-5:]]),
        arquivo(EMENDA_DA_ANA[:-1]),
        arquivo(EMENDA_DA_ANA, EMENDA_DA_ANA),
    ],
)
def test_falha_alto_quando_o_arquivo_muda_de_formato(conteudo: bytes) -> None:
    conector = ConectorEmendasDoPortal(Cliente(200, conteudo), relogio=lambda: AGORA)
    with pytest.raises(FonteMudouDeFormatoError):
        conector.validar(bruta(conteudo))


def test_resposta_sem_sucesso_e_fonte_indisponivel() -> None:
    conector = ConectorEmendasDoPortal(Cliente(503, b""), relogio=lambda: AGORA)
    with pytest.raises(FonteIndisponivelError):
        list(conector.coletar(JANELA))
