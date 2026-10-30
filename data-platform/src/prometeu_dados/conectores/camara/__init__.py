"""Câmara dos Deputados: API de Dados Abertos v2 e o serviço legado SitCamaraWS.

API v2: https://dadosabertos.camara.leg.br/swagger/api.html. O SitCamaraWS
(https://www.camara.leg.br/SitCamaraWS/) é a única fonte da justificativa das ausências.
"""

from prometeu_dados.conectores.camara.deputados import ConectorDeputadosDaCamara
from prometeu_dados.conectores.camara.frequencia import ConectorFrequenciaDaCamara
from prometeu_dados.conectores.camara.proposicoes import ConectorProposicoesDaCamara
from prometeu_dados.conectores.camara.votacoes import ConectorVotacoesDaCamara

__all__ = [
    "ConectorDeputadosDaCamara",
    "ConectorFrequenciaDaCamara",
    "ConectorProposicoesDaCamara",
    "ConectorVotacoesDaCamara",
]
