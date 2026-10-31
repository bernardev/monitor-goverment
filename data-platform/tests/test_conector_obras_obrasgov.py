import json
from datetime import UTC, datetime
from typing import Any

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.obrasgov import ConectorObrasDoObrasGov
from prometeu_dados.conectores.obrasgov.obras import API
from prometeu_dados.rede import FonteIndisponivelError, RespostaHttp

AGORA = datetime(2026, 10, 31, 12, 0, tzinfo=UTC)
JANELA = JanelaDeColeta(inicio=AGORA, fim=AGORA)

# Registros no formato da API pública do Obrasgov.br, com obras e valores fictícios.
EMPENHO_DA_UBS = {
    "ug_emitente": 257001,
    "id_projeto_investimento": "151020.43-16",
    "programa_trabalho": "10301511921720035",
    "plano_interno": "EMENDAS",
    "fonte": "1000",
    "natureza_despesa": 444042,
    "valor_empenho": 481104.37,
    "data_emissao": "2026-03-02",
    "acao_orcamentaria": "2172",
    "codigo_autor_emenda": "202690010001.0",
    "nr_empenho": "2026NE000123",
    "pago": None,
    "descricao_empenho": "CONSTRUCAO DE UBS  EMENDA 202690010001",
}
EMPENHO_SEM_EMENDA = {
    **EMPENHO_DA_UBS,
    "id_projeto_investimento": "1.00-01",
    "codigo_autor_emenda": "0",
}
EMPENHO_ANTIGO = {
    **EMPENHO_DA_UBS,
    "id_projeto_investimento": "2.00-02",
    "codigo_autor_emenda": "202233330001",
}
EMPENHO_DA_PONTE = {
    **EMPENHO_DA_UBS,
    "id_projeto_investimento": "72343.33-91",
    "codigo_autor_emenda": "202571060003",
    "valor_empenho": 1000,
    "nr_empenho": "2025NE000001",
    "data_emissao": None,
    "acao_orcamentaria": "",
    "pago": 250.5,
}
UBS = {
    "id_projeto_investimento": "151020.43-16",
    "desc_nome": "IMPLANTACAO  UBS",
    "nr_cep": "93226-430",
    "desc_endereco": "AVENIDA EXEMPLO, 100",
    "desc_projeto": "IMPLANTACAO UBS",
    "dt_inicial_prevista": "2026-01-10",
    "dt_final_prevista": "2027-06-30",
    "dt_cadastro": "2026-02-17",
    "natureza_intervencao": "Obra",
    "especie_intervencao": "Construção",
    "situacao": "Em execução",
    "uf_principal": "RS",
    "organizacao_resp": "FUNDO NACIONAL DE SAUDE",
    "cnpj_organizacao_resp": "00530493000171",
    "dt_inicial_efetiva": "2026-03-01",
    "dt_final_efetiva": None,
    "sistema_resp": "Transferegov.br",
    "repassadores": [
        {"organizacao_repassador": "FUNDO NACIONAL DE SAUDE", "cnpj_repassador": "00530493000171"}
    ],
    "tomadores": [
        {"organizacao_tomador": "FUNDO MUNICIPAL DE SAUDE", "cnpj_tomador": "11413810000196"}
    ],
    "executores": [
        {"organizacao_executor": "FUNDO MUNICIPAL DE SAUDE", "cnpj_executor": "11413810000196"}
    ],
    "investimentos_previstos": [
        {"vl_investimento_previsto": 200000.1, "desc_nome_fonte_recurso": "Federal"}
    ],
    "eixos_tipos": [{"eixo": "Social", "tipo": "Saúde", "subtipo": "UBS"}],
    "pins": [
        {
            "pin": "POINT (-51.132884323596954 -29.841416322122967)",
            "latitude": "-29.841416322122967",
            "longitude": "-51.132884323596954",
        },
        # Sem espaço depois de POINT, a fonte recorta errado a longitude; o WKT está certo.
        {"pin": "POINT(-35.2218917 -9.01025)", "latitude": "-9.01025", "longitude": "9.01025)"},
    ],
}
PONTE = {**UBS, "id_projeto_investimento": "72343.33-91", "desc_nome": "PONTE", "pins": []}
EXECUCAO = {
    "id_projeto_investimento": "151020.43-16",
    "id_execucao_fisica": 51,
    "percentual_execucao_fisica": 23.35,
    "dt_inicial_execucao": "2026-03-01T00:00:00",
    "dt_final_execucao": None,
    "tipo_instrumento": "Convênio",
    "tipo_forma_execucao": "Repasse",
    "dt_cadastro_execucao": "2026-03-01T11:24:15.217000",
    "dt_atualizacao_execucao": "2026-10-21",
    "indicativos": [],
    "motivos": [{"descricao_motivo": "Revisão de projeto básico"}],
}
PARALISACAO = {
    "id_historico_situacao_investimento": 1188874,
    "descricao_historico_situacao_investimento": "Paralisada",
    "data_historico_situacao_investimento": "2026-09-21",
    "justificativa_cancelada_paralisada": "Solicitado pela empresa.",
    "possui_tratativas_situacao_investimento": "Não",
    "fase_tratativas_situacao_investimento": None,
    "id_projeto_investimento": "72343.33-91",
}
LOCAL = {
    "id_projeto_investimento": "151020.43-16",
    "id_geometria": 806557,
    "sg_uf": "RS",
    "no_municipio": "Sapucaia do Sul",
    "cod_ibge": 4320008,
    "origem_geometria": "Par de Lat/Long",
}


def pagina(*itens: dict[str, Any], total: int = 1) -> bytes:
    return json.dumps({"data": list(itens), "total_pages": total}).encode()


def paginada(recurso: str, numero: int) -> str:
    return f"{API}/{recurso}?pagina={numero}&tamanho_da_pagina=200"


def projeto(identificador: str) -> str:
    return f"{API}/projeto-investimento?id_projeto_investimento={identificador}"


RESPOSTAS = {
    paginada("empenho", 1): pagina(EMPENHO_SEM_EMENDA, EMPENHO_DA_PONTE, total=2),
    paginada("empenho", 2): pagina(EMPENHO_ANTIGO, EMPENHO_DA_UBS, total=2),
    projeto("151020.43-16"): pagina(UBS),
    projeto("72343.33-91"): pagina(PONTE),
    paginada("execucao-fisica", 1): pagina(EXECUCAO, EXECUCAO),
    paginada("historico-situacao-cancelada-paralisada", 1): pagina(PARALISACAO),
    paginada("geometria", 1): pagina(LOCAL, {**LOCAL, "cod_ibge": None, "no_municipio": None}),
}


class Cliente:
    def __init__(self, respostas: dict[str, bytes], status: int = 200) -> None:
        self._respostas = respostas
        self._status = status
        self.pedidos: list[str] = []

    def obter(self, url: str) -> RespostaHttp:
        self.pedidos.append(url)
        return RespostaHttp(url, self._status, self._respostas[url], "application/json")


def conector(cliente: Cliente) -> ConectorObrasDoObrasGov:
    return ConectorObrasDoObrasGov(cliente, relogio=lambda: AGORA)


def registros(tabela: str) -> list[dict[str, Any]]:
    c = conector(Cliente(RESPOSTAS))
    return [dict(r.dados) for b in c.coletar(JANELA) for r in c.normalizar(b) if r.tabela == tabela]


def bruta(url: str, conteudo: bytes) -> RespostaBruta:
    return RespostaBruta("obrasgov", url, AGORA, conteudo, "application/json")


def test_busca_so_os_projetos_ligados_a_emendas_do_periodo_depois_as_listas_inteiras() -> None:
    cliente = Cliente(RESPOSTAS)

    list(conector(cliente).coletar(JANELA))

    assert cliente.pedidos == [
        paginada("empenho", 1),
        paginada("empenho", 2),
        projeto("151020.43-16"),
        projeto("72343.33-91"),
        paginada("execucao-fisica", 1),
        paginada("historico-situacao-cancelada-paralisada", 1),
        paginada("geometria", 1),
    ]


def test_empenho_entra_so_com_codigo_de_emenda_e_valores_em_centavos() -> None:
    ponte, ubs = registros("obrasgov_empenho_de_emenda")

    assert ubs == {
        "id_projeto": "151020.43-16",
        "ug_emitente": "257001",
        "numero_empenho": "2026NE000123",
        "codigo_emenda": "202690010001",
        "acao_orcamentaria": "2172",
        "programa_trabalho": "10301511921720035",
        "plano_interno": "EMENDAS",
        "valor_empenhado_centavos": 48_110_437,
        "pago_centavos": None,
        "emitido_em": "2026-03-02",
        "descricao": "CONSTRUCAO DE UBS EMENDA 202690010001",
    }
    assert ponte["codigo_emenda"] == "202571060003"
    assert ponte["acao_orcamentaria"] is None
    assert ponte["valor_empenhado_centavos"] == 100_000
    assert ponte["pago_centavos"] == 25_050


def test_projeto_com_organizacoes_investimento_e_pontos() -> None:
    ubs, ponte = registros("obrasgov_projeto")

    assert ubs == {
        "id_projeto": "151020.43-16",
        "nome": "IMPLANTACAO UBS",
        "descricao": "IMPLANTACAO UBS",
        "natureza": "Obra",
        "especie": "Construção",
        "situacao": "Em execução",
        "uf": "RS",
        "cep": "93226-430",
        "endereco": "AVENIDA EXEMPLO, 100",
        "inicio_previsto": "2026-01-10",
        "fim_previsto": "2027-06-30",
        "inicio_efetivo": "2026-03-01",
        "fim_efetivo": None,
        "cadastrado_em": "2026-02-17",
        "organizacao_responsavel": "FUNDO NACIONAL DE SAUDE",
        "cnpj_organizacao_responsavel": "00530493000171",
        "executores": [{"nome": "FUNDO MUNICIPAL DE SAUDE", "cnpj": "11413810000196"}],
        "tomadores": [{"nome": "FUNDO MUNICIPAL DE SAUDE", "cnpj": "11413810000196"}],
        "repassadores": [{"nome": "FUNDO NACIONAL DE SAUDE", "cnpj": "00530493000171"}],
        "investimentos_previstos": [{"fonte": "Federal", "valor_centavos": 20_000_010}],
        "tipos": [{"eixo": "Social", "tipo": "Saúde", "subtipo": "UBS"}],
        "localizacoes": [
            {"latitude": "-29.841416322122967", "longitude": "-51.132884323596954"},
            {"latitude": "-9.01025", "longitude": "-35.2218917"},
        ],
        "sistema_responsavel": "Transferegov.br",
    }
    assert ponte["localizacoes"] == []


def test_execucao_historico_e_localizacao_de_todas_as_obras() -> None:
    execucao, repetida = registros("obrasgov_execucao_fisica")
    (paralisacao,) = registros("obrasgov_situacao")
    local, sem_municipio = registros("obrasgov_localizacao")

    # A fonte repete linhas idênticas; a chave da prata as junta.
    assert execucao == repetida
    assert execucao == {
        "id_execucao": 51,
        "id_projeto": "151020.43-16",
        "percentual_centesimos": 2335,
        "inicio": "2026-03-01",
        "fim": None,
        "tipo_instrumento": "Convênio",
        "forma_execucao": "Repasse",
        "cadastrada_em": "2026-03-01",
        "atualizada_em": "2026-10-21",
        "motivos": ["Revisão de projeto básico"],
    }
    assert paralisacao == {
        "id_historico": 1188874,
        "id_projeto": "72343.33-91",
        "situacao": "Paralisada",
        "em": "2026-09-21",
        "justificativa": "Solicitado pela empresa.",
        "com_tratativas": False,
        "fase_das_tratativas": None,
    }
    assert local["codigo_municipio_ibge"] == "4320008"
    assert local["municipio"] == "Sapucaia do Sul"
    assert sem_municipio["codigo_municipio_ibge"] is None


def test_medicao_acima_de_100_fica_como_a_fonte_informa() -> None:
    url = paginada("execucao-fisica", 1)
    c = conector(Cliente({}))
    (registro,) = c.normalizar(
        bruta(url, pagina({**EXECUCAO, "percentual_execucao_fisica": 101.94}))
    )
    assert registro.dados["percentual_centesimos"] == 10_194


@pytest.mark.parametrize(
    ("url", "conteudo"),
    [
        (paginada("empenho", 1), b"nao e json"),
        (paginada("empenho", 1), json.dumps({"itens": []}).encode()),
        (paginada("empenho", 1), pagina({**EMPENHO_DA_UBS, "valor_empenho": 1.234})),
        (paginada("empenho", 1), pagina({**EMPENHO_DA_UBS, "nr_empenho": " "})),
        (projeto("151020.43-16"), pagina(PONTE)),
        (projeto("151020.43-16"), pagina({**UBS, "cnpj_organizacao_resp": "005.304"})),
        (projeto("151020.43-16"), pagina({**UBS, "uf_principal": "XX"})),
        (projeto("151020.43-16"), pagina({**UBS, "dt_cadastro": "17/02/2026"})),
        (projeto("151020.43-16"), pagina({**UBS, "pins": [{"pin": "POINT(1 abc)"}]})),
        (projeto("151020.43-16"), pagina({**UBS, "pins": [{"pin": "POINT(10 95)"}]})),
        (projeto("151020.43-16"), pagina({**UBS, "situacao": None})),
        (paginada("execucao-fisica", 1), pagina({**EXECUCAO, "percentual_execucao_fisica": -1})),
        (paginada("execucao-fisica", 1), pagina({**EXECUCAO, "id_projeto_investimento": "x"})),
        (
            paginada("historico-situacao-cancelada-paralisada", 1),
            pagina({**PARALISACAO, "descricao_historico_situacao_investimento": "Atrasada"}),
        ),
        (paginada("geometria", 1), pagina({**LOCAL, "cod_ibge": 43})),
    ],
)
def test_falha_alto_quando_a_fonte_muda_de_formato(url: str, conteudo: bytes) -> None:
    with pytest.raises(FonteMudouDeFormatoError):
        conector(Cliente({})).validar(bruta(url, conteudo))


def test_resposta_sem_sucesso_e_fonte_indisponivel() -> None:
    cliente = Cliente({paginada("empenho", 1): b""}, status=503)
    with pytest.raises(FonteIndisponivelError):
        list(conector(cliente).coletar(JANELA))
