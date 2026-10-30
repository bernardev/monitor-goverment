"""Ponto de entrada do Dagster: registra ativos, agendas e sensores de todos os conectores.

Cada conector contribui com seus ativos (bronze → prata) aqui.
Ainda não há conectores implementados.
"""

from dagster import Definitions

defs = Definitions(assets=[])
