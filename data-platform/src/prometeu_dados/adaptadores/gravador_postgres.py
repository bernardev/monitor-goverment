"""Prata e outbox no schema `ingestao`, na mesma transação (ADR-0007, ADR-0015)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from prometeu_dados.prata import EventoDeIntegracao, Lote, RegistroPrata, lote_ingerido

SCHEMA = "ingestao"
COLUNAS_DE_ORIGEM = (
    "origem_fonte",
    "origem_url",
    "origem_coletada_em",
    "origem_sha256",
    "origem_caminho",
    "origem_tipo_de_conteudo",
)


def _agora() -> datetime:
    return datetime.now(UTC)


class GravadorPrataPostgres:
    def __init__(self, url_do_banco: str, relogio: Callable[[], datetime] = _agora) -> None:
        self._url = url_do_banco
        self._relogio = relogio

    def gravar(self, lote: Lote, id_de_correlacao: str) -> list[EventoDeIntegracao]:
        agora = self._relogio()
        eventos: list[EventoDeIntegracao] = []
        with psycopg.connect(self._url) as conexao, conexao.transaction():
            for tabela, registros in lote.por_tabela().items():
                evento = lote_ingerido(lote, tabela, len(registros), id_de_correlacao, agora)
                _gravar_registros(conexao, tabela, registros, evento.id)
                _publicar(conexao, evento)
                eventos.append(evento)
        return eventos


def _gravar_registros(
    conexao: psycopg.Connection, tabela: str, registros: list[RegistroPrata], lote_id: str
) -> None:
    primeiro = registros[0]
    colunas_de_dados = tuple(primeiro.dados)
    colunas = (*colunas_de_dados, "lote_id", *COLUNAS_DE_ORIGEM)
    atualizaveis = [c for c in colunas if c not in primeiro.chave_natural]
    comando = sql.SQL(
        "INSERT INTO {tabela} ({colunas}) VALUES ({valores}) "
        "ON CONFLICT ({chave}) DO UPDATE SET {atualizacoes}, atualizado_em = now()"
    ).format(
        tabela=sql.Identifier(SCHEMA, tabela),
        colunas=sql.SQL(", ").join(map(sql.Identifier, colunas)),
        valores=sql.SQL(", ").join(sql.Placeholder() * len(colunas)),
        chave=sql.SQL(", ").join(map(sql.Identifier, primeiro.chave_natural)),
        atualizacoes=sql.SQL(", ").join(
            sql.SQL("{c} = EXCLUDED.{c}").format(c=sql.Identifier(c)) for c in atualizaveis
        ),
    )
    with conexao.cursor() as cursor:
        cursor.executemany(
            comando,
            [
                (
                    *(_valor(registro.dados[c]) for c in colunas_de_dados),
                    lote_id,
                    registro.origem.fonte,
                    registro.origem.url,
                    registro.origem.coletada_em,
                    registro.origem.sha256,
                    registro.origem.caminho_no_bronze,
                    registro.origem.tipo_de_conteudo,
                )
                for registro in registros
            ],
        )


def _valor(valor: object) -> object:
    """Listas e objetos vão para colunas `jsonb`; o resto o psycopg adapta sozinho."""
    return Jsonb(valor) if isinstance(valor, list | dict) else valor


def _publicar(conexao: psycopg.Connection, evento: EventoDeIntegracao) -> None:
    conexao.execute(
        "INSERT INTO ingestao.outbox "
        "(id, tipo, versao, ocorrido_em, id_do_agregado, id_de_correlacao, dados) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (
            evento.id,
            evento.tipo,
            evento.versao,
            evento.ocorrido_em.astimezone(UTC),
            evento.id_do_agregado,
            evento.id_de_correlacao,
            Jsonb(dict(evento.dados)),
        ),
    )
