from collections.abc import Iterator
from datetime import UTC, datetime

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.ingestao import ingerir
from prometeu_dados.prata import EventoDeIntegracao, Lote, Origem, RegistroPrata, lote_ingerido

AGORA = datetime(2026, 10, 30, 9, 0, tzinfo=UTC)
JANELA = JanelaDeColeta(inicio=AGORA, fim=AGORA)


def uma_resposta(conteudo: bytes) -> RespostaBruta:
    return RespostaBruta("exemplo", "https://fonte.gov.br/x", AGORA, conteudo, "application/json")


class ConectorFalso:
    nome = "exemplo"
    versao_do_contrato = "1.2.0"

    def __init__(self, *conteudos: bytes) -> None:
        self._conteudos = conteudos

    def coletar(self, janela: JanelaDeColeta) -> Iterator[RespostaBruta]:
        yield from (uma_resposta(c) for c in self._conteudos)

    def validar(self, resposta: RespostaBruta) -> None:
        if resposta.conteudo == b"quebrado":
            raise FonteMudouDeFormatoError("formato novo")

    def normalizar(self, resposta: RespostaBruta) -> Iterator[RegistroPrata]:
        yield RegistroPrata(
            "exemplo_tabela",
            ("id",),
            {"id": resposta.conteudo.decode()},
            Origem.da_resposta(resposta),
        )


class ArmazemEmMemoria:
    def __init__(self) -> None:
        self.guardadas: list[RespostaBruta] = []

    def guardar(self, resposta: RespostaBruta) -> None:
        self.guardadas.append(resposta)


class GravadorEmMemoria:
    def __init__(self) -> None:
        self.lotes: list[Lote] = []

    def gravar(self, lote: Lote, id_de_correlacao: str) -> list[EventoDeIntegracao]:
        self.lotes.append(lote)
        return [
            lote_ingerido(lote, t, len(r), id_de_correlacao, AGORA)
            for t, r in lote.por_tabela().items()
        ]


def test_guarda_no_bronze_e_grava_um_lote_com_todos_os_registros() -> None:
    armazem, gravador = ArmazemEmMemoria(), GravadorEmMemoria()

    eventos = ingerir(ConectorFalso(b"a", b"b"), JANELA, armazem, gravador, relogio=lambda: AGORA)

    assert [r.conteudo for r in armazem.guardadas] == [b"a", b"b"]
    (lote,) = gravador.lotes
    assert [r.dados["id"] for r in lote.registros] == ["a", "b"]
    (evento,) = eventos
    assert evento.tipo == "LoteIngerido"
    assert evento.dados == {
        "fonte": "exemplo",
        "tabela": "exemplo_tabela",
        "versaoDoContrato": "1.2.0",
        "coletadoDe": AGORA.isoformat(),
        "coletadoAte": AGORA.isoformat(),
        "registros": 2,
    }


def test_formato_novo_guarda_a_prova_e_nao_grava_nada_na_prata() -> None:
    armazem, gravador = ArmazemEmMemoria(), GravadorEmMemoria()

    with pytest.raises(FonteMudouDeFormatoError):
        ingerir(ConectorFalso(b"a", b"quebrado"), JANELA, armazem, gravador)

    assert [r.conteudo for r in armazem.guardadas] == [b"a", b"quebrado"]
    assert gravador.lotes == []


def test_registro_exige_a_chave_natural_nos_dados() -> None:
    with pytest.raises(ValueError, match="Chave natural"):
        RegistroPrata("t", ("id",), {"outro": 1}, Origem.da_resposta(uma_resposta(b"x")))
