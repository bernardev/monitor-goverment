"""Conectores das fontes oficiais.

Cada fonte fica em seu próprio subpacote (`camara/`, `senado/`...).
"""

from prometeu_dados.conectores.base import (
    Conector,
    FonteMudouDeFormatoError,
    JanelaDeColeta,
)

__all__ = ["Conector", "FonteMudouDeFormatoError", "JanelaDeColeta"]
