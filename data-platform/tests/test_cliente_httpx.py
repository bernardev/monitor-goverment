import httpx
import pytest

from prometeu_dados.adaptadores.cliente_httpx import ClienteHttpx
from prometeu_dados.rede import FonteIndisponivelError

URL = "https://fonte.gov.br/dados"


def cliente(*respostas: int | Exception) -> tuple[ClienteHttpx, list[float]]:
    fila = list(respostas)
    esperas: list[float] = []

    def responder(requisicao: httpx.Request) -> httpx.Response:
        proxima = fila.pop(0)
        if isinstance(proxima, Exception):
            raise proxima
        return httpx.Response(proxima, content=b"{}", headers={"content-type": "application/json"})

    return (
        ClienteHttpx(
            tentativas=3,
            espera_inicial_em_segundos=1,
            transporte=httpx.MockTransport(responder),
            dormir=esperas.append,
        ),
        esperas,
    )


def test_tenta_de_novo_com_espera_crescente_ate_dar_certo() -> None:
    http, esperas = cliente(504, httpx.ConnectTimeout("lento"), 200)

    resposta = http.obter(URL)

    assert resposta.status == 200
    assert resposta.tipo_de_conteudo == "application/json"
    assert esperas == [1, 2]


def test_desiste_depois_das_tentativas() -> None:
    http, _ = cliente(503, 503, 503)
    with pytest.raises(FonteIndisponivelError, match="3 vezes"):
        http.obter(URL)


def test_erro_do_cliente_nao_e_repetido() -> None:
    http, esperas = cliente(404)
    assert http.obter(URL).status == 404
    assert esperas == []
