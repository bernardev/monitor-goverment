# Módulo `engajamento`

Cidadãos e o que eles acompanham (políticos e cidades); depois, os alertas e as preferências de canal.
Guarda só o identificador do login (`sub`) e os acompanhamentos, nunca nome ou e-mail (ADR-0014).

- **Schema no banco:** `engajamento` (somente este módulo escreve nele, ver ADR-0006).
- **Linguagem:** termos da [linguagem ubíqua](../../docs/dominio/linguagem-ubiqua.md).
- **Mapa de contextos:** [docs/dominio/mapa-de-contextos.md](../../docs/dominio/mapa-de-contextos.md).

## Estrutura (ADR-0003)

| Pasta                | Conteúdo                                                                             |
| -------------------- | ------------------------------------------------------------------------------------ |
| `src/domain`         | Agregados, entidades, objetos de valor, eventos e regras. Sem dependências externas. |
| `src/application`    | Casos de uso e portas (interfaces).                                                  |
| `src/infrastructure` | Adaptadores: repositórios, clientes externos, IA, fila.                              |
| `src/interface`      | Entradas: controllers HTTP, consumidores de eventos, jobs.                           |
| `src/index.ts`       | Único ponto de entrada público.                                                      |
