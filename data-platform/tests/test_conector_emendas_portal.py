import io
import zipfile
from datetime import UTC, datetime
from typing import Any

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.portal_transparencia import ConectorEmendasDoPortal
from prometeu_dados.conectores.portal_transparencia.emendas import (
    ARQUIVO,
    COLUNAS,
    COLUNAS_DOS_CONVENIOS,
    COLUNAS_DOS_FAVORECIDOS,
)
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


# Favorecidos e convênios no mesmo formato. Os nomes de pessoas físicas são fictícios.
INDIVIDUAL = "Emenda Individual - Transferências com Finalidade Definida"
DA_ANA = ["202690010001", "9001", "ANA EXEMPLO", "0001", INDIVIDUAL]
HOSPITAL = [
    *DA_ANA, "202605", "12345678000190", "HOSPITAL  EXEMPLO", "Associação Privada",
    "Pessoa Jurídica", "SP", "SÃO PAULO", "500000,00",
]  # fmt: skip
HOSPITAL_EM_JUNHO = [*HOSPITAL[:5], "202606", *HOSPITAL[6:-1], "250000,00"]
UNIDADE_GESTORA = [
    *DA_ANA, "202605", "250005", "FUNDO NACIONAL DE SAUDE", "Sem informação", "Unidade Gestora",
    "DF", "BRASÍLIA", "1000,00",
]  # fmt: skip
BOLSISTA = [
    *DA_ANA, "202605", "***.111.222-**", "MARIA FICTICIA", "Sem informação", "Pessoa Fisica",
    "SP", "SÃO PAULO", "1200,00",
]  # fmt: skip
OUTRA_BOLSISTA = [
    *DA_ANA, "202605", "***.333.444-**", "JOANA FICTICIA", "Sem informação", "Pessoa Fisica",
    "SP", "SÃO PAULO", "800,50",
]  # fmt: skip
ESTORNO_DE_BOLSA = [
    *DA_ANA, "202605", "***.555.666-**", "LUIZA FICTICIA", "", "Pessoa Fisica",
    "SP", "SÃO PAULO", "-200,00",
]  # fmt: skip
NO_EXTERIOR = [
    *DA_ANA, "202605", "EXPF00001", "JOSEFA FICTICIA", "Sem informação", "Inscrição Genéric",
    "", "Sem informação", "300,00",
]  # fmt: skip
FAVORECIDO_ANTIGO = ["202233330001", *HOSPITAL[1:]]
CONVENIO = [
    "202690010001", "10", "Saúde", "302", "Assistência hospitalar e ambulatorial",
    "SÃO PAULO (UF)", INDIVIDUAL, "06/01/2026", "HOSPITAL  EXEMPLO",
    "AQUISICAO DE EQUIPAMENTO", "825378", "1450000,00",
]  # fmt: skip
CONVENIO_SEM_OBJETO = [*CONVENIO[:9], "", "9AAQKR", "0,00"]


def csv_(cabecalho: tuple[str, ...], linhas: tuple[list[str], ...]) -> bytes:
    texto = io.StringIO()
    for linha in (cabecalho, *linhas):
        texto.write(";".join(f'"{campo}"' for campo in linha) + "\r\n")
    return texto.getvalue().encode("latin-1")


def arquivo(
    *linhas: list[str],
    cabecalho: tuple[str, ...] = COLUNAS,
    favorecidos: tuple[list[str], ...] = (),
    convenios: tuple[list[str], ...] = (),
    sem: str | None = None,
) -> bytes:
    csvs = {
        "EmendasParlamentares.csv": csv_(cabecalho, linhas),
        "EmendasParlamentares_PorFavorecido.csv": csv_(COLUNAS_DOS_FAVORECIDOS, favorecidos),
        "EmendasParlamentares_Convenios.csv": csv_(COLUNAS_DOS_CONVENIOS, convenios),
    }
    conteudo = io.BytesIO()
    with zipfile.ZipFile(conteudo, "w") as zip_:
        for nome, csv_do_arquivo in csvs.items():
            if nome != sem:
                zip_.writestr(nome, csv_do_arquivo)
    return conteudo.getvalue()


class Cliente:
    def __init__(self, status: int, conteudo: bytes) -> None:
        self._status = status
        self._conteudo = conteudo

    def obter(self, url: str) -> RespostaHttp:
        return RespostaHttp(url, self._status, self._conteudo, "application/zip")


def registros(conteudo: bytes, tabela: str = "transparencia_emenda") -> list[dict[str, Any]]:
    conector = ConectorEmendasDoPortal(Cliente(200, conteudo), relogio=lambda: AGORA)
    return [
        dict(r.dados)
        for b in conector.coletar(JANELA)
        for r in conector.normalizar(b)
        if r.tabela == tabela
    ]


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
        arquivo(EMENDA_DA_ANA, sem="EmendasParlamentares_PorFavorecido.csv"),
        arquivo(EMENDA_DA_ANA, sem="EmendasParlamentares_Convenios.csv"),
        arquivo(favorecidos=([*HOSPITAL[:9], "Pessoa Desconhecida", *HOSPITAL[10:]],)),
        arquivo(favorecidos=([*HOSPITAL[:6], "12.345.678/0001-90", *HOSPITAL[7:]],)),
        arquivo(favorecidos=([*HOSPITAL[:5], "202613", *HOSPITAL[6:]],)),
        arquivo(favorecidos=([*HOSPITAL[:10], "XX", *HOSPITAL[11:]],)),
        arquivo(favorecidos=(HOSPITAL, HOSPITAL)),
        arquivo(convenios=([*CONVENIO[:7], "2026-01-06", *CONVENIO[8:]],)),
        arquivo(convenios=([*CONVENIO[:7], "31/02/2026", *CONVENIO[8:]],)),
        arquivo(convenios=([*CONVENIO[:8], " ", *CONVENIO[9:]],)),
        arquivo(convenios=([*CONVENIO[:-1], "-1,00"],)),
        arquivo(convenios=(CONVENIO, CONVENIO)),
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


def test_favorecido_identificado_entra_por_mes_com_documento_e_nome() -> None:
    hospital, junho, unidade = registros(
        arquivo(favorecidos=(HOSPITAL, HOSPITAL_EM_JUNHO, UNIDADE_GESTORA)),
        "transparencia_emenda_favorecido",
    )

    assert hospital == {
        "codigo_emenda": "202690010001",
        "mes": "2026-05",
        "tipo_favorecido": "Pessoa Jurídica",
        "codigo_favorecido": "12345678000190",
        "nome_favorecido": "HOSPITAL EXEMPLO",
        "natureza_juridica": "Associação Privada",
        "uf": "SP",
        "municipio": "SÃO PAULO",
        "quantidade": 1,
        "valor_centavos": 50_000_000,
    }
    assert junho["mes"] == "2026-06"
    assert junho["valor_centavos"] == 25_000_000
    assert unidade["tipo_favorecido"] == "Unidade Gestora"
    assert unidade["codigo_favorecido"] == "250005"
    assert unidade["natureza_juridica"] is None


def test_pessoas_fisicas_sao_somadas_por_mes_e_municipio_sem_nome_nem_cpf() -> None:
    somados = registros(
        arquivo(favorecidos=(BOLSISTA, NO_EXTERIOR, OUTRA_BOLSISTA, ESTORNO_DE_BOLSA)),
        "transparencia_emenda_favorecido",
    )

    assert somados == [
        {
            "codigo_emenda": "202690010001",
            "mes": "2026-05",
            "tipo_favorecido": "Inscrição Genérica",
            "codigo_favorecido": None,
            "nome_favorecido": None,
            "natureza_juridica": None,
            "uf": None,
            "municipio": None,
            "quantidade": 1,
            "valor_centavos": 30_000,
        },
        {
            "codigo_emenda": "202690010001",
            "mes": "2026-05",
            "tipo_favorecido": "Pessoa Física",
            "codigo_favorecido": None,
            "nome_favorecido": None,
            "natureza_juridica": None,
            "uf": "SP",
            "municipio": "SÃO PAULO",
            "quantidade": 3,
            "valor_centavos": 180_050,
        },
    ]
    texto = repr(somados)
    assert "FICTICIA" not in texto
    assert "***" not in texto


def test_favorecidos_de_orcamentos_anteriores_ficam_de_fora() -> None:
    assert (
        registros(arquivo(favorecidos=(FAVORECIDO_ANTIGO,)), "transparencia_emenda_favorecido")
        == []
    )


def test_convenio_por_emenda_e_classificacao_com_data_e_valor() -> None:
    convenio, sem_objeto = registros(
        arquivo(convenios=(CONVENIO, CONVENIO_SEM_OBJETO)), "transparencia_emenda_convenio"
    )

    assert convenio == {
        "codigo_emenda": "202690010001",
        "numero_convenio": "825378",
        "codigo_funcao": "10",
        "nome_funcao": "Saúde",
        "codigo_subfuncao": "302",
        "nome_subfuncao": "Assistência hospitalar e ambulatorial",
        "localidade": "SÃO PAULO (UF)",
        "publicado_em": "2026-01-06",
        "convenente": "HOSPITAL EXEMPLO",
        "objeto": "AQUISICAO DE EQUIPAMENTO",
        "valor_centavos": 145_000_000,
    }
    assert sem_objeto["numero_convenio"] == "9AAQKR"
    assert sem_objeto["objeto"] is None
