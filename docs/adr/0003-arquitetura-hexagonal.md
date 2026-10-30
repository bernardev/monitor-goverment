# ADR-0003: Arquitetura hexagonal dentro de cada módulo

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

As regras de negócio (ex.: "veredito sensível exige revisor diferente do curador") precisam ser testáveis
sem banco, sem HTTP e sem IA, e precisam sobreviver a trocas de tecnologia (outro banco de busca, outro
provedor de IA, outro canal de alerta).

## Decisão

Cada módulo segue **portas e adaptadores** com quatro camadas:

```
modules/<contexto>/src/
├── domain/          Entidades, agregados, objetos de valor, eventos, regras. Zero dependência externa.
├── application/     Casos de uso (comandos e consultas), portas (interfaces) que o domínio precisa.
├── infrastructure/  Adaptadores: repositórios Drizzle, clientes de API, IA, fila, e-mail.
└── interface/       Entradas: controllers HTTP, consumidores de eventos, jobs.
```

Regra de dependência: `interface → application → domain` e `infrastructure → application/domain`.
O domínio não conhece nenhuma outra camada.

Convenções:

- Casos de uso são classes com um único método `execute(input)` e retornam `Result<T, DomainError>`
  (vocabulário técnico em inglês, ver [ADR-0011](0011-linguagem-ubiqua-em-portugues.md)).
- Regras de negócio não lançam exceção; exceções são reservadas para falhas de infraestrutura.
- Repositórios trabalham com agregados inteiros, nunca com tabelas soltas.

## Alternativas consideradas

- **MVC com services gordos:** regras espalhadas e acopladas ao ORM.
- **Clean Architecture com mais camadas:** cerimônia extra sem ganho para o nosso tamanho.

## Consequências

- **Positivas:** domínio testado em milissegundos; troca de tecnologia isolada em adaptadores.
- **Negativas:** mapeamento entre modelo de domínio e modelo de persistência (aceitamos o custo).
