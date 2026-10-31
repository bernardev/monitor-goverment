import json

import httpx

from prometeu_dados.adaptadores.alerta_webhook import AlertaPorWebhook


def cliente(status: int, recebidos: list[httpx.Request]) -> httpx.Client:
    def responder(pedido: httpx.Request) -> httpx.Response:
        recebidos.append(pedido)
        return httpx.Response(status)

    return httpx.Client(transport=httpx.MockTransport(responder))


def test_envia_o_texto_nos_campos_dos_chats_comuns() -> None:
    recebidos: list[httpx.Request] = []
    alerta = AlertaPorWebhook("https://chat.exemplo/webhook", cliente(200, recebidos))

    assert alerta.avisar("camara_votacoes falhou") is True
    (pedido,) = recebidos
    assert json.loads(pedido.content) == {
        "text": "camara_votacoes falhou",
        "content": "camara_votacoes falhou",
    }


def test_sem_webhook_nao_envia() -> None:
    recebidos: list[httpx.Request] = []

    assert AlertaPorWebhook(None, cliente(200, recebidos)).avisar("x") is False
    assert AlertaPorWebhook("", cliente(200, recebidos)).avisar("x") is False
    assert recebidos == []


def test_webhook_que_recusa_ou_nao_responde_nao_levanta_erro() -> None:
    assert AlertaPorWebhook("https://chat.exemplo/w", cliente(500, [])).avisar("x") is False

    def cair(pedido: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("fora do ar", request=pedido)

    fora = httpx.Client(transport=httpx.MockTransport(cair))
    assert AlertaPorWebhook("https://chat.exemplo/w", fora).avisar("x") is False
