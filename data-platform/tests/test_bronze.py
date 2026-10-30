from datetime import UTC, datetime, timedelta, timezone

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import JanelaDeColeta

BRASILIA = timezone(timedelta(hours=-3))


def uma_resposta(conteudo: bytes = b'{"dados": []}', **campos: object) -> RespostaBruta:
    padrao: dict[str, object] = {
        "fonte": "camara",
        "url": "https://dadosabertos.camara.leg.br/api/v2/deputados",
        "coletado_em": datetime(2027, 2, 1, 23, 30, tzinfo=BRASILIA),
        "conteudo": conteudo,
        "tipo_de_conteudo": "application/json",
    }
    padrao.update(campos)
    return RespostaBruta(**padrao)  # type: ignore[arg-type]


def test_hash_identifica_o_conteudo() -> None:
    assert uma_resposta(b"a").sha256 == uma_resposta(b"a").sha256
    assert uma_resposta(b"a").sha256 != uma_resposta(b"b").sha256


def test_caminho_particiona_por_data_em_utc() -> None:
    resposta = uma_resposta()
    # 23h30 em Brasília é 02h30 do dia seguinte em UTC.
    assert str(resposta.caminho_no_bronze()) == f"bronze/camara/2027/02/02/{resposta.sha256}"


def test_exige_fuso_horario() -> None:
    with pytest.raises(ValueError, match="fuso"):
        uma_resposta(coletado_em=datetime(2027, 2, 1))  # noqa: DTZ001


def test_rejeita_nome_de_fonte_que_nao_serve_de_caminho() -> None:
    with pytest.raises(ValueError, match="fonte"):
        uma_resposta(fonte="../camara")


def test_janela_de_coleta_valida_ordem() -> None:
    agora = datetime.now(UTC)
    with pytest.raises(ValueError, match="anterior"):
        JanelaDeColeta(inicio=agora, fim=agora - timedelta(days=1))
