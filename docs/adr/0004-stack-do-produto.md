# ADR-0004: Stack do produto: TypeScript, NestJS, Next.js, monorepo

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

Precisamos de uma stack com tipagem forte, ecossistema maduro, boa contratação no Brasil e que permita
compartilhar contratos entre API, site e painel editorial.

## Decisão

| Peça             | Escolha                                                   | Motivo                                                                           |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Linguagem        | **TypeScript** (modo `strict`)                            | Uma linguagem do banco à tela; contratos compartilhados.                         |
| Runtime          | **Node.js 24 LTS** (mínimo 22.12)                         | Padrão de mercado. O Node 20 saiu de suporte em abril de 2026.                   |
| Compilador       | **TypeScript 6.0**                                        | A 7.0 (reescrita em Go) ainda não é suportada pelo typescript-eslint.            |
| Módulos          | **ESM** em todos os pacotes                               | O NestJS 12 só é distribuído como ESM.                                           |
| API e worker     | **NestJS**                                                | Módulos e injeção de dependência casam com monólito modular e hexagonal.         |
| Persistência     | **Drizzle ORM** + SQL explícito                           | Schemas por módulo, migrações versionadas, sem "mágica" que esconda queries.     |
| Validação        | **Zod**                                                   | Valida entradas na borda e gera tipos.                                           |
| Contrato HTTP    | **OpenAPI** gerado a partir dos controllers               | Cliente tipado gerado para o site e para terceiros.                              |
| Site público     | **Next.js** (App Router, SSR/ISR)                         | SEO é crítico: cada político e promessa é uma página indexável e compartilhável. |
| Painel editorial | **Next.js** (app separado)                                | Ciclo de deploy e permissões diferentes do site.                                 |
| UI               | Design system próprio em `packages/ui` (Tailwind + Radix) | Consistência e acessibilidade.                                                   |
| Monorepo         | **pnpm workspaces + Turborepo**                           | Build incremental e cache.                                                       |
| Testes           | **Vitest**, **Testcontainers**, **Playwright**            | Ver [convenções](../engenharia/convencoes.md).                                   |

## Alternativas consideradas

- **Python (FastAPI) para tudo:** ótimo para dados, mas perderíamos contratos compartilhados com o front.
- **Java/Kotlin (Spring):** robusto, porém mais pesado para uma equipe pequena começar.
- **Prisma:** cliente único gerado para o banco todo, o que incentiva acoplamento entre módulos.

## Consequências

- **Positivas:** tipos de ponta a ponta; uma linguagem para o produto.
- **Negativas:** ingestão de dados pesada fica em Python ([ADR-0005](0005-plataforma-de-dados-python.md)),
  então o projeto é poliglota. A fronteira entre as duas é um contrato explícito.
