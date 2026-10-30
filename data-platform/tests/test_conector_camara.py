import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.camara import ConectorDeputadosDaCamara
from prometeu_dados.rede import FonteIndisponivelError, RespostaHttp

FIXTURES = Path(__file__).parent / "fixtures" / "camara"
API = "https://dadosabertos.camara.leg.br/api/v2"
AGORA = datetime(2026, 10, 30, 9, 0, tzinfo=UTC)
JANELA = JanelaDeColeta(inicio=AGORA, fim=AGORA)
LEGISLATURAS = f"{API}/legislaturas?data=2026-10-30"
PAGINA_1 = f"{API}/deputados?idLegislatura=57&itens=2&ordem=ASC&ordenarPor=nome"


class ClienteGravado:
    """Devolve respostas gravadas por URL e registra a ordem das chamadas."""

    def __init__(self, respostas: dict[str, tuple[int, bytes]]) -> None:
        self._respostas = respostas
        self.chamadas: list[str] = []

    def obter(self, url: str) -> RespostaHttp:
        self.chamadas.append(url)
        status, conteudo = self._respostas[url]
        return RespostaHttp(url, status, conteudo, "application/json")


def fixture(nome: str) -> bytes:
    return (FIXTURES / nome).read_bytes()


def cliente_padrao() -> ClienteGravado:
    return ClienteGravado(
        {
            LEGISLATURAS: (200, fixture("legislaturas_2026-10-30.json")),
            PAGINA_1: (200, fixture("deputados_pagina_1.json")),
            f"{PAGINA_1}&pagina=2": (200, fixture("deputados_pagina_2.json")),
            **{
                f"{API}/deputados/{id_deputado}/historico": (
                    200,
                    fixture(f"historico_{id_deputado}.json"),
                )
                for id_deputado in (900001, 900002, 900003)
            },
        }
    )


def conector(cliente: ClienteGravado) -> ConectorDeputadosDaCamara:
    return ConectorDeputadosDaCamara(
        cliente, relogio=lambda: AGORA, itens_por_pagina=2, consultas_simultaneas=2
    )


def resposta(url: str, corpo: Any) -> RespostaBruta:
    return RespostaBruta("camara", url, AGORA, json.dumps(corpo).encode(), "application/json")


def deputados() -> dict[int, list[dict[str, Any]]]:
    camara = conector(cliente_padrao())
    linhas: dict[int, list[dict[str, Any]]] = {}
    for bruta in camara.coletar(JANELA):
        for registro in camara.normalizar(bruta):
            if registro.tabela == "camara_deputado":
                linhas.setdefault(registro.dados["id_deputado"], []).append(dict(registro.dados))
    return linhas


def test_acha_a_legislatura_percorre_as_paginas_e_le_cada_historico_uma_vez() -> None:
    cliente = cliente_padrao()

    respostas = list(conector(cliente).coletar(JANELA))

    assert [r.url for r in respostas] == [
        LEGISLATURAS,
        PAGINA_1,
        f"{PAGINA_1}&pagina=2",
        f"{API}/deputados/900001/historico",
        f"{API}/deputados/900002/historico",
        f"{API}/deputados/900003/historico",
    ]
    assert sorted(cliente.chamadas) == sorted(r.url for r in respostas)
    assert all(r.fonte == "camara" and r.coletado_em == AGORA for r in respostas)


def test_periodos_de_exercicio_seguem_posse_licenca_e_reassuncao() -> None:
    ana_56, ana_57 = deputados()[900001]

    assert ana_57 == {
        "id_deputado": 900001,
        "id_legislatura": 57,
        "nome": "Ana Exemplo",
        "sigla_partido": "POU",
        "sigla_uf": "SP",
        "url_foto": "https://www.camara.leg.br/internet/deputado/bandep/900001.jpg",
        "exercicios": [
            {"inicio": "2023-02-01T12:05:00-03:00", "fim": "2026-03-31T18:00:00-03:00"},
            {"inicio": "2026-07-31T10:30:00-03:00", "fim": None},
        ],
    }
    assert ana_56["id_legislatura"] == 56
    assert ana_56["exercicios"] == [
        {"inicio": "2019-02-01T10:00:00-03:00", "fim": "2023-01-31T23:59:00-03:00"}
    ]


def test_suplente_que_ja_saiu_continua_na_prata_com_o_periodo_fechado() -> None:
    (bruno,) = deputados()[900002]

    assert bruno["exercicios"] == [
        {"inicio": "2026-06-16T17:13:00-03:00", "fim": "2026-10-15T00:00:00-03:00"}
    ]
    assert bruno["url_foto"] is None


def test_suplente_que_nunca_assumiu_nao_entra() -> None:
    assert 900003 not in deputados()


def test_linha_carrega_a_origem_do_historico() -> None:
    camara = conector(cliente_padrao())
    historico = list(camara.coletar(JANELA))[4]

    (registro,) = camara.normalizar(historico)

    assert registro.chave_natural == ("id_deputado", "id_legislatura")
    assert registro.origem.url == f"{API}/deputados/900002/historico"
    assert registro.origem.sha256 == historico.sha256


def test_normaliza_a_legislatura_em_curso() -> None:
    camara = conector(cliente_padrao())
    legislaturas = next(iter(camara.coletar(JANELA)))

    (registro,) = camara.normalizar(legislaturas)

    assert registro.tabela == "camara_legislatura"
    assert registro.dados == {
        "id_legislatura": 57,
        "data_inicio": date(2023, 2, 1),
        "data_fim": date(2027, 1, 31),
    }


def test_respostas_gravadas_passam_na_validacao() -> None:
    camara = conector(cliente_padrao())
    for resposta_bruta in camara.coletar(JANELA):
        camara.validar(resposta_bruta)


def entrada_do_historico(**mudancas: Any) -> dict[str, Any]:
    (primeira, *_) = json.loads(fixture("historico_900002.json"))["dados"]
    return {**primeira, "situacao": "Exercício", **mudancas}


@pytest.mark.parametrize(
    "entrada",
    [
        entrada_do_historico(situacao="Licenciado"),
        entrada_do_historico(id=900001),
        entrada_do_historico(dataHora="16/06/2026 17:13"),
        entrada_do_historico(siglaUf="XX"),
        entrada_do_historico(siglaPartido=None),
        entrada_do_historico(idLegislatura="57"),
    ],
)
def test_falha_alto_quando_o_historico_muda_de_formato(entrada: dict[str, Any]) -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(
            resposta(f"{API}/deputados/900002/historico", {"dados": [entrada], "links": []})
        )


@pytest.mark.parametrize(
    "corpo",
    [
        {"dados": {"id": 1}},
        {"dados": [{"id": "900001", "idLegislatura": 57, "nome": "X"}]},
        {"dados": [{"id": True, "idLegislatura": 57, "nome": "X"}]},
        ["não é objeto"],
    ],
)
def test_falha_alto_quando_a_lista_de_deputados_muda_de_formato(corpo: Any) -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(resposta(PAGINA_1, corpo))


@pytest.mark.parametrize(
    "dados",
    [
        [{"id": 57, "dataInicio": "01/02/2023", "dataFim": "2027-01-31"}],
        [{"id": 57, "dataInicio": "2027-01-31", "dataFim": "2023-02-01"}],
        [{"id": 57, "dataInicio": "2023-02-01"}],
        [],
        [
            {"id": 56, "dataInicio": "2019-02-01", "dataFim": "2023-01-31"},
            {"id": 57, "dataInicio": "2023-02-01", "dataFim": "2027-01-31"},
        ],
    ],
)
def test_falha_alto_quando_a_legislatura_muda_de_formato(dados: list[Any]) -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(resposta(LEGISLATURAS, {"dados": dados, "links": []}))


def test_conteudo_que_nao_e_json_e_mudanca_de_formato() -> None:
    camara = conector(cliente_padrao())
    bruta = RespostaBruta("camara", PAGINA_1, AGORA, b"<html>manutencao</html>", "text/html")
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(bruta)


def test_resposta_sem_sucesso_e_fonte_indisponivel() -> None:
    cliente = ClienteGravado({LEGISLATURAS: (404, b"")})
    with pytest.raises(FonteIndisponivelError):
        list(conector(cliente).coletar(JANELA))
