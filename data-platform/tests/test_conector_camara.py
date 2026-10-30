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
            f"{API}/deputados?itens=2&ordem=ASC&ordenarPor=nome": (
                200,
                fixture("deputados_pagina_1.json"),
            ),
            f"{API}/deputados?itens=2&ordem=ASC&ordenarPor=nome&pagina=2": (
                200,
                fixture("deputados_pagina_2.json"),
            ),
            f"{API}/legislaturas/57": (200, fixture("legislatura_57.json")),
        }
    )


def conector(cliente: ClienteGravado) -> ConectorDeputadosDaCamara:
    return ConectorDeputadosDaCamara(cliente, relogio=lambda: AGORA, itens_por_pagina=2)


def resposta(url: str, corpo: Any) -> RespostaBruta:
    return RespostaBruta("camara", url, AGORA, json.dumps(corpo).encode(), "application/json")


def test_percorre_as_paginas_e_busca_a_legislatura_citada() -> None:
    cliente = cliente_padrao()

    respostas = list(conector(cliente).coletar(JANELA))

    assert [r.url for r in respostas] == cliente.chamadas
    assert cliente.chamadas[-1] == f"{API}/legislaturas/57"
    assert len(respostas) == 3
    assert all(r.fonte == "camara" and r.coletado_em == AGORA for r in respostas)


def test_normaliza_deputados_com_a_origem_de_cada_linha() -> None:
    camara = conector(cliente_padrao())
    respostas = list(camara.coletar(JANELA))

    registros = [r for resposta in respostas for r in camara.normalizar(resposta)]
    deputados = [r for r in registros if r.tabela == "camara_deputado"]

    assert [d.dados["id_deputado"] for d in deputados] == [900001, 900002, 900003]
    ana, bruno, _ = deputados
    assert ana.dados == {
        "id_deputado": 900001,
        "id_legislatura": 57,
        "nome": "Ana Exemplo",
        "sigla_partido": "PEX",
        "sigla_uf": "SP",
        "url_foto": "https://www.camara.leg.br/internet/deputado/bandep/900001.jpg",
        "email": "dep.anaexemplo@camara.leg.br",
    }
    assert bruno.dados["url_foto"] is None
    assert bruno.dados["email"] is None
    assert ana.chave_natural == ("id_deputado", "id_legislatura")
    assert ana.origem.sha256 == respostas[0].sha256
    assert ana.origem.caminho_no_bronze == str(respostas[0].caminho_no_bronze())


def test_normaliza_a_legislatura() -> None:
    camara = conector(cliente_padrao())
    legislatura = list(camara.coletar(JANELA))[-1]

    (registro,) = camara.normalizar(legislatura)

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


@pytest.mark.parametrize(
    "corpo",
    [
        {"dados": {"id": 1}},
        {"dados": [{"id": "900001", "idLegislatura": 57, "nome": "X", "siglaPartido": "P"}]},
        {
            "dados": [
                {"id": 1, "idLegislatura": 57, "nome": "X", "siglaPartido": "P", "siglaUf": "XX"}
            ]
        },
        {"dados": [{"id": True, "idLegislatura": 57, "nome": "X", "siglaPartido": "P"}]},
        ["não é objeto"],
    ],
)
def test_falha_alto_quando_a_lista_de_deputados_muda_de_formato(corpo: Any) -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(resposta(f"{API}/deputados?pagina=1", corpo))


@pytest.mark.parametrize(
    "dados",
    [
        {"id": 57, "dataInicio": "01/02/2023", "dataFim": "2027-01-31"},
        {"id": 57, "dataInicio": "2027-01-31", "dataFim": "2023-02-01"},
        {"id": 57, "dataInicio": "2023-02-01"},
    ],
)
def test_falha_alto_quando_a_legislatura_muda_de_formato(dados: dict[str, Any]) -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(resposta(f"{API}/legislaturas/57", {"dados": dados, "links": []}))


def test_conteudo_que_nao_e_json_e_mudanca_de_formato() -> None:
    camara = conector(cliente_padrao())
    bruta = RespostaBruta(
        "camara", f"{API}/deputados", AGORA, b"<html>manutencao</html>", "text/html"
    )
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(bruta)


def test_resposta_sem_sucesso_e_fonte_indisponivel() -> None:
    cliente = ClienteGravado({f"{API}/deputados?itens=2&ordem=ASC&ordenarPor=nome": (404, b"")})
    with pytest.raises(FonteIndisponivelError):
        list(conector(cliente).coletar(JANELA))
