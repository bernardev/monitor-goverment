import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.camara import ConectorProposicoesDaCamara
from prometeu_dados.conectores.camara.proposicoes import BRASILIA
from prometeu_dados.conectores.senado import ConectorProposicoesDoSenado
from prometeu_dados.prata import RegistroPrata
from prometeu_dados.rede import RespostaHttp

FIXTURES = Path(__file__).parent / "fixtures"
CAMARA = "https://dadosabertos.camara.leg.br/api/v2"
SENADO = "https://legis.senado.leg.br/dadosabertos"
AGORA = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)
JANELA = JanelaDeColeta(inicio=AGORA - timedelta(days=3), fim=AGORA)
LISTA_DA_CAMARA = (
    f"{CAMARA}/proposicoes?siglaTipo=PEC&siglaTipo=PLP&siglaTipo=PL&siglaTipo=MPV&siglaTipo=PDL"
    "&dataInicio=2026-10-27&dataFim=2026-10-30&itens=100&ordem=ASC&ordenarPor=id"
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


def resposta(fonte: str, url: str, corpo: Any) -> RespostaBruta:
    return RespostaBruta(fonte, url, AGORA, json.dumps(corpo).encode(), "application/json")


def registros(conector: Any) -> list[RegistroPrata]:
    return [r for bruta in conector.coletar(JANELA) for r in conector.normalizar(bruta)]


def cliente_da_camara() -> ClienteGravado:
    respostas = {LISTA_DA_CAMARA: (200, fixture("camara/proposicoes_lista.json"))}
    for id_proposicao in (900301, 900302):
        base = f"{CAMARA}/proposicoes/{id_proposicao}"
        respostas[base] = (200, fixture(f"camara/proposicao_{id_proposicao}.json"))
        respostas[f"{base}/autores"] = (200, fixture(f"camara/autores_{id_proposicao}.json"))
        respostas[f"{base}/tramitacoes"] = (
            200,
            fixture(f"camara/tramitacoes_{id_proposicao}.json"),
        )
    return ClienteGravado(respostas)


def camara(cliente: ClienteGravado | None = None) -> ConectorProposicoesDaCamara:
    return ConectorProposicoesDaCamara(
        cliente or cliente_da_camara(), relogio=lambda: AGORA, consultas_simultaneas=2
    )


class TestCamara:
    def test_lista_os_tipos_normativos_e_le_detalhe_autores_e_tramitacoes(self) -> None:
        cliente = cliente_da_camara()

        respostas = list(camara(cliente).coletar(JANELA))

        assert [r.url for r in respostas] == [
            LISTA_DA_CAMARA,
            f"{CAMARA}/proposicoes/900301",
            f"{CAMARA}/proposicoes/900301/autores",
            f"{CAMARA}/proposicoes/900301/tramitacoes",
            f"{CAMARA}/proposicoes/900302",
            f"{CAMARA}/proposicoes/900302/autores",
            f"{CAMARA}/proposicoes/900302/tramitacoes",
        ]

    def test_normaliza_a_proposicao_com_a_situacao_atual(self) -> None:
        (pl, mpv) = (r for r in registros(camara()) if r.tabela == "camara_proposicao")

        assert pl.dados == {
            "id_proposicao": 900301,
            "sigla_tipo": "PL",
            "numero": 901,
            "ano": 2026,
            "ementa": "Dispõe sobre um tema fictício.",
            "apresentada_em": datetime(2026, 3, 2, 10, 0, tzinfo=BRASILIA),
            "url_inteiro_teor": "https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=900301",
            "situacao": {
                "sequencia": 3,
                "data_hora": "2026-10-28T15:00:00-03:00",
                "sigla_orgao": "CCJC",
                "descricao_tramitacao": "Parecer do Relator",
                "descricao_situacao": "Aguardando Parecer",
                "despacho": "Parecer pela aprovação.",
                "url": None,
            },
        }
        assert mpv.dados["situacao"] is None

    def test_autores_com_o_deputado_identificado_pela_uri(self) -> None:
        (autores, executivo) = (
            r for r in registros(camara()) if r.tabela == "camara_proposicao_autores"
        )

        assert autores.dados["autores"] == [
            {
                "nome": "Ana Exemplo",
                "tipo": "Deputado(a)",
                "id_deputado": 900001,
                "ordem_assinatura": 1,
                "proponente": True,
            },
            {
                "nome": "Comissão de Exemplo",
                "tipo": "Órgão do Poder Legislativo",
                "id_deputado": None,
                "ordem_assinatura": 2,
                "proponente": False,
            },
        ]
        assert executivo.dados["autores"][0]["id_deputado"] is None

    def test_tramitacoes_em_ordem_de_sequencia(self) -> None:
        (tramitacoes, vazia) = (
            r for r in registros(camara()) if r.tabela == "camara_proposicao_tramitacoes"
        )

        assert [t["sequencia"] for t in tramitacoes.dados["tramitacoes"]] == [1, 3]
        assert tramitacoes.dados["tramitacoes"][0]["descricao_situacao"] is None
        assert vazia.dados == {"id_proposicao": 900302, "tramitacoes": []}

    def test_sequencia_repetida_guarda_os_dois_despachos_na_ordem_da_fonte(self) -> None:
        corpo = {
            "dados": [
                {"dataHora": "2019-12-11T10:00", "sequencia": 38, "despacho": "Parecer."},
                {"dataHora": "2019-12-11T10:00", "sequencia": 38, "despacho": "Discussão."},
                {"dataHora": "2019-12-10T10:00", "sequencia": 37, "despacho": "Pauta."},
            ]
        }
        url = f"{CAMARA}/proposicoes/900301/tramitacoes"

        (registro,) = camara().normalizar(resposta("camara", url, corpo))

        despachos = [t["despacho"] for t in registro.dados["tramitacoes"]]
        assert despachos == ["Pauta.", "Parecer.", "Discussão."]

    def test_respostas_gravadas_passam_na_validacao(self) -> None:
        conector = camara()
        for bruta in conector.coletar(JANELA):
            conector.validar(bruta)

    @pytest.mark.parametrize(
        ("url", "corpo"),
        [
            (LISTA_DA_CAMARA, {"dados": [{"id": 1, "siglaTipo": "REQ"}], "links": []}),
            (f"{CAMARA}/proposicoes/900301", {"dados": {"id": 900302}}),
            (
                f"{CAMARA}/proposicoes/900301/tramitacoes",
                {"dados": [{"dataHora": "28/10/2026", "sequencia": 1}]},
            ),
            (f"{CAMARA}/proposicoes/900301/autores", {"dados": [{"nome": "X"}]}),
        ],
    )
    def test_falha_alto_quando_muda_de_formato(self, url: str, corpo: Any) -> None:
        with pytest.raises(FonteMudouDeFormatoError):
            camara().validar(resposta("camara", url, corpo))


def cliente_do_senado() -> ClienteGravado:
    respostas = {
        f"{SENADO}/processo?sigla={tipo}&numdias=3": (200, b"[]")
        for tipo in ("PEC", "PLP", "MPV", "PDL")
    }
    respostas[f"{SENADO}/processo?sigla=PL&numdias=3"] = (200, fixture("senado/processos_PL.json"))
    respostas[f"{SENADO}/processo/900401"] = (200, fixture("senado/processo_900401.json"))
    return ClienteGravado(respostas)


def senado(cliente: ClienteGravado | None = None) -> ConectorProposicoesDoSenado:
    return ConectorProposicoesDoSenado(cliente or cliente_do_senado(), relogio=lambda: AGORA)


class TestSenado:
    def test_lista_por_tipo_os_atualizados_na_janela_e_le_cada_processo(self) -> None:
        cliente = cliente_do_senado()

        respostas = list(senado(cliente).coletar(JANELA))

        assert [r.url for r in respostas][-1] == f"{SENADO}/processo/900401"
        assert len(respostas) == 6

    def test_normaliza_o_processo_com_autoria_e_situacoes(self) -> None:
        (processo,) = registros(senado())

        assert processo.tabela == "senado_processo"
        assert processo.dados == {
            "id_processo": 900401,
            "codigo_materia": 9000401,
            "sigla": "PL",
            "numero": 903,
            "ano": 2026,
            "ementa": "Altera uma lei fictícia.",
            "apresentada_em": date(2026, 4, 1),
            "casa_iniciadora": "SF",
            "tramitando": True,
            "situacao": {
                "sigla": "AGDREL",
                "descricao": "AGUARDANDO DESIGNAÇÃO DO RELATOR",
                "desde": "2026-10-20",
            },
            "autores": [
                {
                    "nome": "Ana Senadora",
                    "tipo": "SENADOR",
                    "codigo_parlamentar": 900101,
                    "sigla_partido": "PEX",
                    "uf": "SP",
                    "ordem": 1,
                },
                {
                    # O código do Senado não identifica deputados.
                    "nome": "Bruno Deputado",
                    "tipo": "DEPUTADO",
                    "codigo_parlamentar": None,
                    "sigla_partido": "PMO",
                    "uf": "BA",
                    "ordem": 2,
                },
            ],
            "situacoes": [
                {
                    "sigla": "PRONTPLEN",
                    "descricao": "PRONTA PARA A PAUTA NO PLENÁRIO",
                    "inicio": "2026-04-01",
                    "fim": "2026-10-20",
                    "colegiado": None,
                },
                {
                    "sigla": "AGDREL",
                    "descricao": "AGUARDANDO DESIGNAÇÃO DO RELATOR",
                    "inicio": "2026-10-20",
                    "fim": None,
                    "colegiado": "CCJ",
                },
            ],
            "norma_gerada": None,
            "url_documento": f"{SENADO}/documento/abc",
        }

    def test_janela_alem_de_30_dias_e_recusada(self) -> None:
        longa = JanelaDeColeta(inicio=AGORA - timedelta(days=31), fim=AGORA)
        with pytest.raises(ValueError, match="30"):
            list(senado().coletar(longa))

    @pytest.mark.parametrize(
        "mudanca",
        [{"id": 1}, {"sigla": "REQ"}, {"tramitando": "Talvez"}, {"numero": "novecentos"}],
    )
    def test_falha_alto_quando_muda_de_formato(self, mudanca: dict[str, Any]) -> None:
        corpo = {**json.loads(fixture("senado/processo_900401.json")), **mudanca}
        with pytest.raises(FonteMudouDeFormatoError):
            senado().validar(resposta("senado", f"{SENADO}/processo/900401", corpo))
