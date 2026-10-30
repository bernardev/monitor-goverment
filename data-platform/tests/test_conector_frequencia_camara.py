from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.camara import ConectorFrequenciaDaCamara
from prometeu_dados.rede import FonteIndisponivelError, RespostaHttp

FIXTURES = Path(__file__).parent / "fixtures" / "camara"
SERVICO = "https://www.camara.leg.br/SitCamaraWS"
DEPUTADOS = f"{SERVICO}/Deputados.asmx/ObterDeputados"
AGORA = datetime(2026, 10, 30, 9, 0, tzinfo=UTC)
# 02h UTC do dia 1º ainda é 30/09 em Brasília: a janela vale no calendário de Brasília.
JANELA = JanelaDeColeta(inicio=datetime(2026, 10, 1, 2, 0, tzinfo=UTC), fim=AGORA)


def presencas(matricula: int) -> str:
    return (
        f"{SERVICO}/sessoesreunioes.asmx/ListarPresencasParlamentar"
        f"?dataIni=30/09/2026&dataFim=30/10/2026&numMatriculaParlamentar={matricula}"
    )


class ClienteGravado:
    def __init__(self, respostas: dict[str, tuple[int, bytes]]) -> None:
        self._respostas = respostas
        self.chamadas: list[str] = []

    def obter(self, url: str) -> RespostaHttp:
        self.chamadas.append(url)
        status, conteudo = self._respostas[url]
        return RespostaHttp(url, status, conteudo, "text/xml; charset=utf-8")


def fixture(nome: str) -> bytes:
    return (FIXTURES / nome).read_bytes()


def cliente_padrao() -> ClienteGravado:
    return ClienteGravado(
        {
            DEPUTADOS: (200, fixture("obter_deputados.xml")),
            presencas(701): (200, fixture("presencas_701.xml")),
            presencas(702): (404, b"The resource you are looking for has been removed"),
        }
    )


def conector(cliente: ClienteGravado) -> ConectorFrequenciaDaCamara:
    return ConectorFrequenciaDaCamara(cliente, relogio=lambda: AGORA, consultas_simultaneas=2)


def resposta(url: str, corpo: str) -> RespostaBruta:
    return RespostaBruta("camara", url, AGORA, corpo.encode(), "text/xml")


def test_lista_os_deputados_e_busca_a_frequencia_de_cada_matricula_na_janela() -> None:
    cliente = cliente_padrao()

    respostas = list(conector(cliente).coletar(JANELA))

    assert sorted(cliente.chamadas) == sorted([DEPUTADOS, presencas(701), presencas(702)])
    # A matrícula 702 respondeu 404: sem dado, nada é guardado, e isso não vira ausência.
    assert [r.url for r in respostas] == [DEPUTADOS, presencas(701)]


def test_normaliza_a_correspondencia_entre_matricula_e_id_da_api() -> None:
    camara = conector(cliente_padrao())
    deputados = next(iter(camara.coletar(JANELA)))

    registros = list(camara.normalizar(deputados))

    assert [(r.tabela, dict(r.dados)) for r in registros] == [
        ("camara_matricula", {"matricula": 701, "id_deputado": 900001}),
        ("camara_matricula", {"matricula": 702, "id_deputado": 900002}),
    ]
    assert registros[0].chave_natural == ("matricula",)


def test_normaliza_cada_dia_com_a_justificativa_e_as_sessoes() -> None:
    camara = conector(cliente_padrao())
    frequencia = list(camara.coletar(JANELA))[1]

    presente, justificada, ausente = camara.normalizar(frequencia)

    assert presente.tabela == "camara_frequencia_dia"
    assert presente.chave_natural == ("matricula", "dia")
    assert presente.dados == {
        "matricula": 701,
        "dia": date(2026, 10, 1),
        "frequencia": "Presença",
        "justificativa": None,
        "sessoes": [{"descricao": "EXTRAORDINÁRIA Nº 206 - 01/10/2026", "frequencia": "Presença"}],
    }
    assert justificada.dados["frequencia"] == "Ausência justificada"
    assert justificada.dados["justificativa"] == "Missão Autorizada"
    assert len(justificada.dados["sessoes"]) == 2
    assert ausente.dados["frequencia"] == "Ausência"
    assert ausente.dados["justificativa"] is None
    assert presente.origem.url == presencas(701)


def test_respostas_gravadas_passam_na_validacao() -> None:
    camara = conector(cliente_padrao())
    for resposta_bruta in camara.coletar(JANELA):
        camara.validar(resposta_bruta)


DIA = """
<dia><data>{data}</data><frequencianoDia>{frequencia}</frequencianoDia><justificativa/>
<qtdeSessoes>1</qtdeSessoes><sessoes><sessao><descricao>EXTRA</descricao>
<frequencia>Presença</frequencia></sessao></sessoes></dia>
"""


def parlamentar(matricula: str = "701", dias: str = "") -> str:
    return (
        f"<parlamentar><carteiraParlamentar>{matricula}</carteiraParlamentar>"
        f"<diasDeSessoes2>{dias}</diasDeSessoes2></parlamentar>"
    )


@pytest.mark.parametrize(
    "corpo",
    [
        "não é xml",
        "<deputados/>",
        parlamentar(matricula="999"),
        "<parlamentar><carteiraParlamentar>701</carteiraParlamentar></parlamentar>",
        parlamentar(dias=DIA.format(data="2026-10-01", frequencia="Presença")),
        parlamentar(dias=DIA.format(data="01/10/2026 11:40:00", frequencia="Presente")),
        '<!DOCTYPE x [<!ENTITY a "a">]><parlamentar/>',
    ],
    ids=[
        "nao_e_xml",
        "raiz_errada",
        "outra_matricula",
        "sem_dias",
        "data_em_outro_formato",
        "frequencia_desconhecida",
        "entidade_declarada",
    ],
)
def test_formato_inesperado_falha_alto(corpo: str) -> None:
    with pytest.raises(FonteMudouDeFormatoError):
        conector(cliente_padrao()).validar(resposta(presencas(701), corpo))


def test_lista_de_deputados_sem_matricula_falha_alto() -> None:
    corpo = "<deputados><deputado><ideCadastro>1</ideCadastro></deputado></deputados>"
    with pytest.raises(FonteMudouDeFormatoError):
        conector(cliente_padrao()).validar(resposta(DEPUTADOS, corpo))


def test_fonte_fora_do_ar_interrompe_a_coleta() -> None:
    cliente = ClienteGravado(
        {
            DEPUTADOS: (200, fixture("obter_deputados.xml")),
            presencas(701): (503, b""),
            presencas(702): (200, fixture("presencas_701.xml")),
        }
    )
    with pytest.raises(FonteIndisponivelError):
        list(conector(cliente).coletar(JANELA))
