from datetime import UTC, datetime, timedelta

import pytest

from prometeu_dados.conectores import JanelaDeColeta

INICIO = datetime(2023, 2, 1, 3, 0, tzinfo=UTC)


def test_divide_em_partes_consecutivas_sem_repetir_a_divisa() -> None:
    janela = JanelaDeColeta(INICIO, INICIO + timedelta(days=75))

    partes = janela.em_partes(timedelta(days=30))

    assert [(p.inicio, p.fim) for p in partes] == [
        (INICIO, INICIO + timedelta(days=30, microseconds=-1)),
        (INICIO + timedelta(days=30), INICIO + timedelta(days=60, microseconds=-1)),
        (INICIO + timedelta(days=60), INICIO + timedelta(days=75)),
    ]


def test_janela_menor_que_o_passo_fica_inteira() -> None:
    janela = JanelaDeColeta(INICIO, INICIO + timedelta(days=10))

    assert janela.em_partes(timedelta(days=30)) == [janela]


def test_passo_exato_nao_cria_parte_vazia() -> None:
    janela = JanelaDeColeta(INICIO, INICIO + timedelta(days=60))

    assert len(janela.em_partes(timedelta(days=30))) == 2


def test_passo_precisa_ser_positivo() -> None:
    with pytest.raises(ValueError, match="positivo"):
        JanelaDeColeta(INICIO, INICIO).em_partes(timedelta(0))
