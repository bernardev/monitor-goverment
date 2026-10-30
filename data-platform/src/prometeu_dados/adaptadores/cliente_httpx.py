"""Cliente HTTP com novas tentativas: fontes oficiais caem com frequência (a Câmara devolve 504) e
limitam o ritmo das consultas (429)."""

from __future__ import annotations

import time
from collections.abc import Callable

import httpx

from prometeu_dados.rede import FonteIndisponivelError, RespostaHttp

AGENTE = "prometeu-dados/0.1 (+https://github.com/bernardev/monitor-goverment)"


class ClienteHttpx:
    def __init__(
        self,
        tentativas: int = 4,
        espera_inicial_em_segundos: float = 2.0,
        tempo_limite_em_segundos: float = 60.0,
        transporte: httpx.BaseTransport | None = None,
        dormir: Callable[[float], None] = time.sleep,
    ) -> None:
        self._tentativas = tentativas
        self._espera_inicial = espera_inicial_em_segundos
        self._dormir = dormir
        self._http = httpx.Client(
            headers={"User-Agent": AGENTE, "Accept": "application/json"},
            timeout=tempo_limite_em_segundos,
            follow_redirects=True,
            transport=transporte,
        )

    def obter(self, url: str) -> RespostaHttp:
        ultimo_erro = ""
        pedida: float | None = None
        for tentativa in range(self._tentativas):
            if tentativa > 0:
                # A fonte que pede para esperar (Retry-After) sabe melhor do que o recuo padrão.
                self._dormir(pedida or self._espera_inicial * 2 ** (tentativa - 1))
            try:
                resposta = self._http.get(url)
            except httpx.TransportError as erro:
                ultimo_erro = f"{type(erro).__name__}: {erro}"
                pedida = None
                continue
            if resposta.status_code >= 500 or resposta.status_code == 429:
                ultimo_erro = f"HTTP {resposta.status_code}"
                pedida = _segundos(resposta.headers.get("retry-after"))
                continue
            return RespostaHttp(
                url=url,
                status=resposta.status_code,
                conteudo=resposta.content,
                tipo_de_conteudo=resposta.headers.get("content-type", ""),
                cabecalhos=dict(resposta.headers),
            )
        raise FonteIndisponivelError(f"{url} falhou {self._tentativas} vezes ({ultimo_erro})")

    def fechar(self) -> None:
        self._http.close()


def _segundos(retry_after: str | None) -> float | None:
    """`Retry-After` em segundos; a forma com data HTTP fica com o recuo padrão."""
    if retry_after is None or not retry_after.strip().isdigit():
        return None
    return float(retry_after.strip())
