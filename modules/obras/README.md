# Módulo `obras`

Obras públicas, situação, medições, localização e registros enviados por cidadãos.

- **Schema no banco:** `obras` (somente este módulo escreve nele, ver ADR-0006).
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
