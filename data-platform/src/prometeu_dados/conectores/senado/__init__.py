"""Senado Federal: Dados Abertos (https://legis.senado.leg.br/dadosabertos/docs/)."""

from prometeu_dados.conectores.senado.proposicoes import ConectorProposicoesDoSenado
from prometeu_dados.conectores.senado.senadores import ConectorSenadoresDoSenado
from prometeu_dados.conectores.senado.votacoes import ConectorVotacoesDoSenado

__all__ = ["ConectorProposicoesDoSenado", "ConectorSenadoresDoSenado", "ConectorVotacoesDoSenado"]
