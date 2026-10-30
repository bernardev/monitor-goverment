# ADR-0001: Registrar decisões arquiteturais em ADRs

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

O projeto vai crescer em escopo (três esferas de governo) e em pessoas. Sem registro, decisões viram
folclore: ninguém lembra por que algo foi feito, e o código é alterado de forma inconsistente.

## Decisão

Toda decisão que afete estrutura, dependências, dados ou contratos públicos é registrada como ADR em
`docs/adr/`, no formato do [template](template.md). PRs que contrariem um ADR aceito precisam de um novo ADR.

## Alternativas consideradas

- **Wiki externa:** separa a decisão do código e envelhece sem revisão.
- **Nada formal:** não escala além de uma pessoa.

## Consequências

- **Positivas:** histórico auditável; onboarding rápido; discussões técnicas com base escrita.
- **Negativas:** custo pequeno de escrita a cada decisão relevante.
