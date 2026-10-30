# ADR-0011: Linguagem ubíqua em português no código de domínio

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

O domínio é brasileiro e cheio de termos sem tradução exata (emenda PIX, empenho, liquidação, LOA, PPA,
artigo 17). Traduzir para o inglês cria uma segunda linguagem que ninguém do domínio fala e gera erros de
interpretação.

## Decisão

- Conceitos de **domínio** usam os termos da [linguagem ubíqua](../dominio/linguagem-ubiqua.md) em português,
  sem acento nos identificadores: `Promessa`, `Emenda`, `registrarAusencia`, `VereditoPublicado`.
- Conceitos **técnicos** ficam em inglês: nomes de padrão (`Repository`, `AggregateRoot`, `ValueObject`,
  `DomainEvent`, `Result`, `DomainError`, `Controller`, `Module`, `Mapper`, `Dto`) e seus métodos
  (`execute`, `pullDomainEvents`, `equals`). Ex.: `PromessaRepository`, `EmendaController`.
- Banco: `snake_case` em português (`compromissos.promessa`, `registro_de_veredito`).
- Eventos: substantivo + verbo no particípio, em português (`EmendaPaga`, `ObraParalisada`).
- Commits e documentação: português.

## Consequências

- **Positivas:** código conversa com especialistas, jornalistas e curadores na mesma língua.
- **Negativas:** colaboradores estrangeiros terão uma curva maior (aceitável; o produto é brasileiro).
