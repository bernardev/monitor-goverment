import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from prometeu_dados.bronze import RespostaBruta
from prometeu_dados.conectores import FonteMudouDeFormatoError, JanelaDeColeta
from prometeu_dados.conectores.senado import ConectorSenadoresDoSenado, ConectorVotacoesDoSenado
from prometeu_dados.prata import RegistroPrata
from prometeu_dados.rede import FonteIndisponivelError, RespostaHttp

FIXTURES = Path(__file__).parent / "fixtures" / "senado"
API = "https://legis.senado.leg.br/dadosabertos"
AGORA = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)
HOJE = JanelaDeColeta(inicio=AGORA, fim=AGORA)
MES = JanelaDeColeta(inicio=AGORA - timedelta(days=30), fim=AGORA)
VOTACOES = f"{API}/votacao?dataInicio=2026-09-30&dataFim=2026-10-30"


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
    respostas = {
        f"{API}/senador/lista/atual": (200, fixture("lista_atual.json")),
        f"{API}/senador/lista/legislatura/57": (200, fixture("lista_legislatura_57.json")),
        VOTACOES: (200, fixture("votacoes.json")),
    }
    for codigo in (900101, 900102, 900103):
        respostas[f"{API}/senador/{codigo}/mandatos"] = (200, fixture(f"mandatos_{codigo}.json"))
    for codigo in (900101, 900102):
        respostas[f"{API}/senador/{codigo}"] = (200, fixture(f"senador_{codigo}.json"))
    return ClienteGravado(respostas)


def senadores(cliente: ClienteGravado | None = None) -> ConectorSenadoresDoSenado:
    return ConectorSenadoresDoSenado(cliente or cliente_padrao(), relogio=lambda: AGORA)


def registros(conector: Any, janela: JanelaDeColeta) -> list[RegistroPrata]:
    return [r for bruta in conector.coletar(janela) for r in conector.normalizar(bruta)]


def resposta(url: str, corpo: Any) -> RespostaBruta:
    return RespostaBruta("senado", url, AGORA, json.dumps(corpo).encode(), "application/json")


class TestSenadores:
    def test_le_os_mandatos_de_todos_e_o_detalhe_so_de_quem_exerceu_na_legislatura(self) -> None:
        cliente = cliente_padrao()

        respostas = list(senadores(cliente).coletar(HOJE))

        assert (
            [r.url for r in respostas]
            == cliente.chamadas
            == [
                f"{API}/senador/lista/atual",
                f"{API}/senador/lista/legislatura/57",
                f"{API}/senador/900101/mandatos",
                f"{API}/senador/900101",
                f"{API}/senador/900102/mandatos",
                f"{API}/senador/900102",
                f"{API}/senador/900103/mandatos",
            ]
        )

    def test_exercicios_de_todos_os_mandatos_com_uf_fim_do_mandato_e_causa(self) -> None:
        exercicios = {
            r.dados["codigo"]: r.dados["exercicios"]
            for r in registros(senadores(), HOJE)
            if r.tabela == "senado_exercicios"
        }

        assert set(exercicios) == {900101, 900102}
        assert exercicios[900101] == [
            {
                "codigo_exercicio": 3101,
                "uf": "SP",
                "inicio": "2023-02-01",
                "fim": None,
                "fim_do_mandato": "2031-01-31",
                "causa_do_afastamento": None,
            }
        ]
        assert [
            (e["uf"], e["inicio"], e["fim"], e["causa_do_afastamento"]) for e in exercicios[900102]
        ] == [
            ("RJ", "2015-02-01", "2019-01-31", "TER"),
            ("MG", "2024-03-01", "2024-07-01", "RET"),
            ("MG", "2025-01-10", None, None),
        ]

    def test_detalhe_do_senador(self) -> None:
        detalhes = [r for r in registros(senadores(), HOJE) if r.tabela == "senado_senador"]

        assert [d.dados for d in detalhes] == [
            {
                "codigo": 900101,
                "nome": "Ana Senadora",
                "sigla_partido": "PEX",
                "url_foto": "http://www.senado.leg.br/senadores/img/fotos-oficiais/senador900101.jpg",
            },
            {"codigo": 900102, "nome": "Bruno Suplente", "sigla_partido": "PMO", "url_foto": None},
        ]
        assert detalhes[0].origem.url == f"{API}/senador/900101"

    def test_respostas_gravadas_passam_na_validacao(self) -> None:
        conector = senadores()
        for bruta in conector.coletar(HOJE):
            conector.validar(bruta)

    @pytest.mark.parametrize(
        ("url", "corpo"),
        [
            (f"{API}/senador/lista/atual", {"ListaParlamentarEmExercicio": {"Parlamentares": {}}}),
            (f"{API}/senador/900101/mandatos", {"MandatoParlamentar": {}}),
            (
                f"{API}/senador/900101/mandatos",
                {
                    "MandatoParlamentar": {
                        "Parlamentar": {
                            "Mandatos": {
                                "Mandato": {
                                    "UfParlamentar": "XX",
                                    "PrimeiraLegislaturaDoMandato": {"DataFim": "2027-01-31"},
                                }
                            }
                        }
                    }
                },
            ),
            (
                f"{API}/senador/900101",
                {
                    "DetalheParlamentar": {
                        "Parlamentar": {
                            "IdentificacaoParlamentar": {
                                "CodigoParlamentar": "900102",
                                "NomeParlamentar": "Outro",
                            }
                        }
                    }
                },
            ),
        ],
    )
    def test_falha_alto_quando_muda_de_formato(self, url: str, corpo: Any) -> None:
        with pytest.raises(FonteMudouDeFormatoError):
            senadores().validar(resposta(url, corpo))

    def test_fim_antes_do_inicio_e_mudanca_de_formato(self) -> None:
        corpo = json.loads(fixture("mandatos_900101.json"))
        exercicio = corpo["MandatoParlamentar"]["Parlamentar"]["Mandatos"]["Mandato"]
        exercicio["Exercicios"]["Exercicio"]["DataFim"] = "2022-01-01"
        with pytest.raises(FonteMudouDeFormatoError):
            senadores().validar(resposta(f"{API}/senador/900101/mandatos", corpo))

    def test_resposta_sem_sucesso_e_fonte_indisponivel(self) -> None:
        cliente = ClienteGravado({f"{API}/senador/lista/atual": (503, b"")})
        with pytest.raises(FonteIndisponivelError):
            list(senadores(cliente).coletar(HOJE))


def votacoes() -> list[dict[str, Any]]:
    conector = ConectorVotacoesDoSenado(cliente_padrao(), relogio=lambda: AGORA)
    return [dict(r.dados) for r in registros(conector, MES)]


def votacao_com(**mudancas: Any) -> list[Any]:
    (primeira, _) = json.loads(fixture("votacoes.json"))
    return [{**primeira, **mudancas}]


class TestVotacoes:
    def test_uma_linha_por_votacao_com_a_situacao_de_cada_senador(self) -> None:
        primeira, secreta = votacoes()

        assert {k: v for k, v in primeira.items() if k != "votos"} == {
            "codigo_sessao_votacao": 9101,
            "codigo_sessao": 900001,
            "data": date(2026, 10, 14),
            "descricao": "Votação nominal do Projeto de Lei Complementar nº 901, de 2026.",
            "identificacao": "PLP 901/2026",
            "codigo_materia": 9000001,
            "sigla_materia": "PLP",
            "numero_materia": "901",
            "ano_materia": 2026,
            "ementa": "Tema fictício.",
            "aprovada": True,
            "secreta": False,
        }
        assert [(v["codigo_parlamentar"], v["sigla_voto"]) for v in primeira["votos"]] == [
            (900101, "Sim"),
            (900102, "LS"),
            (900104, "P-NRV"),
            (900105, "Presidente (art. 51 RISF)"),
            (900106, "NCom"),
        ]
        assert primeira["votos"][1] == {
            "codigo_parlamentar": 900102,
            "sigla_voto": "LS",
            "descricao_voto": "Licença saúde",
            "sigla_partido": "PMO",
            "sigla_uf": "MG",
        }
        assert secreta["secreta"] is True
        assert secreta["aprovada"] is None

    def test_respostas_gravadas_passam_na_validacao(self) -> None:
        conector = ConectorVotacoesDoSenado(cliente_padrao(), relogio=lambda: AGORA)
        for bruta in conector.coletar(MES):
            conector.validar(bruta)

    @pytest.mark.parametrize(
        "corpo",
        [
            {"votacoes": []},
            votacao_com(votacaoSecreta="X"),
            votacao_com(resultadoVotacao="T"),
            votacao_com(dataSessao="14/10/2026"),
            votacao_com(votos=[]),
            votacao_com(votos=[{"codigoParlamentar": 1, "siglaVotoParlamentar": "Talvez"}]),
            votacao_com(
                votos=[
                    {"codigoParlamentar": 1, "siglaVotoParlamentar": "Sim"},
                    {"codigoParlamentar": 1, "siglaVotoParlamentar": "Não"},
                ]
            ),
        ],
    )
    def test_falha_alto_quando_muda_de_formato(self, corpo: Any) -> None:
        conector = ConectorVotacoesDoSenado(cliente_padrao(), relogio=lambda: AGORA)
        with pytest.raises(FonteMudouDeFormatoError):
            conector.validar(resposta(VOTACOES, corpo))
