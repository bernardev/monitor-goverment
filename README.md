# Prometeu

> Codinome provisório. Plataforma de acompanhamento do poder público brasileiro: o que foi prometido, o que
> virou lei, o que tem orçamento, o que foi pago e o que foi entregue, com fonte em cada etapa.

## Requisitos

| Ferramenta | Versão                                                         |
| ---------- | -------------------------------------------------------------- |
| Node.js    | 24 LTS (mínimo 22.12), ver `.nvmrc`                            |
| pnpm       | 10, no PATH (o Turborepo chama `pnpm` diretamente), ver abaixo |
| Python     | 3.13, gerenciado pelo [uv](https://docs.astral.sh/uv/)         |
| Docker     | Docker Desktop, para o ambiente local                          |

## Primeiros passos

Deixe o `pnpm` disponível no PATH. Com o Corepack (vem com o Node; no Windows, rode o terminal como
administrador):

```bash
corepack enable pnpm
```

Depois:

```bash
pnpm install
```

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

```bash
pnpm verify
```

`verify` roda formatação, lint, tipos, regras de arquitetura e testes. A plataforma de dados tem os
próprios comandos em [data-platform/README.md](data-platform/README.md).

| Comando      | O que faz                                                  |
| ------------ | ---------------------------------------------------------- |
| `pnpm dev`   | Sobe API, worker, site e painel em modo de desenvolvimento |
| `pnpm test`  | Testes de todos os pacotes                                 |
| `pnpm arch`  | Regras de fronteira entre módulos e camadas                |
| `pnpm build` | Build de produção                                          |

## Estrutura

```
apps/            api, worker (NestJS) · web, curadoria (Next.js)
modules/         um pacote por contexto delimitado (DDD)
packages/        shared-kernel, contracts
data-platform/   coleta das fontes oficiais (Python, Dagster)
infra/docker/    ambiente local (PostgreSQL + pgvector, RustFS)
docs/            arquitetura, domínio, ADRs, engenharia, pesquisa
```

## Documentação

| Assunto                        | Documento                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Visão geral da arquitetura     | [docs/arquitetura/visao-geral.md](docs/arquitetura/visao-geral.md)                 |
| Contextos delimitados (DDD)    | [docs/dominio/mapa-de-contextos.md](docs/dominio/mapa-de-contextos.md)             |
| Linguagem ubíqua (glossário)   | [docs/dominio/linguagem-ubiqua.md](docs/dominio/linguagem-ubiqua.md)               |
| Domínio central: Compromissos  | [docs/dominio/modelo-compromissos.md](docs/dominio/modelo-compromissos.md)         |
| Decisões de arquitetura (ADRs) | [docs/adr/README.md](docs/adr/README.md)                                           |
| Convenções de engenharia       | [docs/engenharia/convencoes.md](docs/engenharia/convencoes.md)                     |
| Pesquisa de mercado            | [docs/pesquisa/concorrentes-e-lacunas.md](docs/pesquisa/concorrentes-e-lacunas.md) |
