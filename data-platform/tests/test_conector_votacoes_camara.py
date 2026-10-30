import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.camara import ConectorVotacoesDaCamara
from prometeu_dados.conectores.camara.votacoes import BRASILIA
from prometeu_dados.prata import RegistroPrata
from prometeu_dados.rede import FonteIndisponivelError, RespostaHttp

FIXTURES = Path(__file__).parent / "fixtures" / "camara"
API = "https://dadosabertos.camara.leg.br/api/v2"
AGORA = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)
JANELA = JanelaDeColeta(inicio=AGORA - timedelta(days=30), fim=AGORA)
LISTA = (
    f"{API}/votacoes?idOrgao=180&dataInicio=2026-09-30&dataFim=2026-10-30"
    "&itens=100&ordem=ASC&ordenarPor=dataHoraRegistro"
)


class ClienteGravado:
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
    respostas = {LISTA: (200, fixture("votacoes_plenario.json"))}
    for votacao in ("900100-10", "900100-12", "900200-5"):
        respostas[f"{API}/votacoes/{votacao}/votos"] = (200, fixture(f"votos_{votacao}.json"))
    for votacao in ("900100-10", "900200-5"):
        respostas[f"{API}/votacoes/{votacao}"] = (200, fixture(f"votacao_{votacao}.json"))
    return ClienteGravado(respostas)


def conector(cliente: ClienteGravado) -> ConectorVotacoesDaCamara:
    return ConectorVotacoesDaCamara(cliente, relogio=lambda: AGORA)


def registros() -> list[RegistroPrata]:
    camara = conector(cliente_padrao())
    return [r for bruta in camara.coletar(JANELA) for r in camara.normalizar(bruta)]


def resposta(url: str, corpo: Any) -> RespostaBruta:
    return RespostaBruta("camara", url, AGORA, json.dumps(corpo).encode(), "application/json")


def test_busca_os_votos_de_cada_votacao_e_o_detalhe_so_das_nominais() -> None:
    cliente = cliente_padrao()

    respostas = list(conector(cliente).coletar(JANELA))

    assert (
        [r.url for r in respostas]
        == cliente.chamadas
        == [
            LISTA,
            f"{API}/votacoes/900100-10/votos",
            f"{API}/votacoes/900100-10",
            f"{API}/votacoes/900100-12/votos",
            f"{API}/votacoes/900200-5/votos",
            f"{API}/votacoes/900200-5",
        ]
    )


def test_votacao_simbolica_nao_entra_na_prata() -> None:
    ids = {r.dados["id_votacao"] for r in registros()}

    assert ids == {"900100-10", "900200-5"}


def test_normaliza_a_votacao_com_as_proposicoes_afetadas() -> None:
    (votacao, _) = (r for r in registros() if r.tabela == "camara_votacao")

    assert votacao.chave_natural == ("id_votacao",)
    assert votacao.dados == {
        "id_votacao": "900100-10",
        "data": date(2026, 10, 14),
        "registrada_em": datetime(2026, 10, 14, 19, 42, 50, tzinfo=BRASILIA),
        "descricao": "Aprovado o Projeto de Lei nº 900, de 2026. Sim: 1; Não: 1; Total: 2.",
        "aprovacao": True,
        "proposicoes": [
            {
                "id": 9009001,
                "sigla_tipo": "PL",
                "numero": 900,
                "ano": 2026,
                "ementa": "Dispõe sobre um tema fictício.",
            }
        ],
    }
    assert votacao.origem.url == f"{API}/votacoes/900100-10"


def test_normaliza_os_votos_com_o_partido_do_dia() -> None:
    (votos, _) = (r for r in registros() if r.tabela == "camara_votos")

    assert votos.dados["id_votacao"] == "900100-10"
    assert votos.dados["votos"] == [
        {
            "id_deputado": 900001,
            "voto": "Sim",
            "registrado_em": "2026-10-14T19:41:40-03:00",
            "sigla_partido": "PEX",
            "sigla_uf": "SP",
        },
        {
            "id_deputado": 900002,
            "voto": "Não",
            "registrado_em": "2026-10-14T19:40:02-03:00",
            "sigla_partido": "PMO",
            "sigla_uf": "BA",
        },
        {
            "id_deputado": 900003,
            "voto": "Artigo 17",
            "registrado_em": "2026-10-14T19:39:00-03:00",
            "sigla_partido": "PEX",
            "sigla_uf": "RS",
        },
    ]
    assert votos.origem.url == f"{API}/votacoes/900100-10/votos"


def test_votacao_secreta_registra_quem_votou_com_o_voto_nulo() -> None:
    (_, secreta) = (r for r in registros() if r.tabela == "camara_votos")

    assert [v["voto"] for v in secreta.dados["votos"]] == [None, None]


def test_respostas_gravadas_passam_na_validacao() -> None:
    camara = conector(cliente_padrao())
    for bruta in camara.coletar(JANELA):
        camara.validar(bruta)


def um_voto(**mudancas: Any) -> dict[str, Any]:
    (primeiro, *_) = json.loads(fixture("votos_900100-10.json"))["dados"]
    return {**primeiro, **mudancas}


@pytest.mark.parametrize(
    "votos",
    [
        [um_voto(tipoVoto="Talvez")],
        [um_voto(), um_voto()],
        [um_voto(dataRegistroVoto="14/10/2026")],
        [um_voto(deputado_={"id": "900001", "siglaPartido": "PEX"})],
        [{"tipoVoto": "Sim"}],
    ],
)
def test_falha_alto_quando_os_votos_mudam_de_formato(votos: list[Any]) -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(resposta(f"{API}/votacoes/900100-10/votos", {"dados": votos}))


def um_detalhe(**mudancas: Any) -> dict[str, Any]:
    detalhe: dict[str, Any] = json.loads(fixture("votacao_900100-10.json"))["dados"]
    return {**detalhe, **mudancas}


@pytest.mark.parametrize(
    "detalhe",
    [
        um_detalhe(id="900100-11"),
        um_detalhe(idOrgao=2000),
        um_detalhe(aprovacao=True),
        um_detalhe(aprovacao=2),
        um_detalhe(data="14/10/2026"),
        um_detalhe(proposicoesAfetadas=[{"id": 1, "siglaTipo": "PL"}]),
        um_detalhe(descricao=None),
    ],
)
def test_falha_alto_quando_o_detalhe_muda_de_formato(detalhe: dict[str, Any]) -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(resposta(f"{API}/votacoes/900100-10", {"dados": detalhe}))


def test_lista_sem_id_e_mudanca_de_formato() -> None:
    camara = conector(cliente_padrao())
    with pytest.raises(FonteMudouDeFormatoError):
        camara.validar(resposta(LISTA, {"dados": [{"uri": "x"}], "links": []}))


def test_resposta_sem_sucesso_e_fonte_indisponivel() -> None:
    cliente = ClienteGravado({LISTA: (503, b"")})
    with pytest.raises(FonteIndisponivelError):
        list(conector(cliente).coletar(JANELA))
