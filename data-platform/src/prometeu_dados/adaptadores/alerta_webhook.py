"""Aviso de falha para a equipe por um webhook de chat (Slack, Mattermost, Discord, Teams)."""

from __future__ import annotations

import httpx


class AlertaPorWebhook:
    """Envia uma mensagem curta ao webhook configurado; sem webhook, não envia nada.

    O corpo leva o texto em `text` (Slack, Mattermost, Teams) e em `content` (Discord): o mesmo
    aviso serve aos chats mais comuns sem configuração por serviço.
    """

    def __init__(self, url: str | None, cliente: httpx.Client | None = None) -> None:
        self._url = url or None
        self._cliente = cliente or httpx.Client(timeout=10)

    def avisar(self, mensagem: str) -> bool:
        """Devolve se o aviso foi entregue. Falha no aviso não pode esconder a falha original."""
        if self._url is None:
            return False
        try:
            resposta = self._cliente.post(self._url, json={"text": mensagem, "content": mensagem})
        except httpx.HTTPError:
            return False
        return resposta.is_success
