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

`verify` roda formatação, lint, tipos, regras de arquitetura e testes. Os testes de integração sobem um
PostgreSQL em contêiner (Testcontainers), então o Docker precisa estar rodando. A plataforma de dados tem os
próprios comandos em [data-platform/README.md](data-platform/README.md).

Se a sua máquina já tiver um PostgreSQL na porta 5432, defina `POSTGRES_PORTA` (ex.: `5433`) antes de
subir o Docker e ao rodar API e worker.

### Ver a fatia de ponta a ponta (deputados da Câmara)

1. Crie as tabelas da prata (na pasta `data-platform`):

   ```bash
   INGESTAO_DATABASE_URL=postgresql://ctx_ingestao:desenvolvimento@localhost:5432/prometeu uv run alembic upgrade head
   ```

2. Compile e suba o worker (aplica as migrações dos módulos, liga relays e consumidores):

   ```bash
   pnpm build
   ```

   ```bash
   node apps/worker/dist/main.js
   ```

3. Colete da Câmara (na pasta `data-platform`, com as variáveis do `.env.example`):

   ```bash
   uv run dagster asset materialize -m prometeu_dados.definicoes --select camara_deputados
   ```

   A frequência no plenário (últimos 30 dias, com o motivo das ausências) leva cerca de meia hora,
   porque o serviço da Câmara responde devagar:

   ```bash
   uv run dagster asset materialize -m prometeu_dados.definicoes --select camara_frequencia
   ```

   As votações nominais do plenário (últimos 30 dias) levam menos de um minuto:

   ```bash
   uv run dagster asset materialize -m prometeu_dados.definicoes --select camara_votacoes
   ```

4. Suba a API e o site; as listas ficam em `http://localhost:3001/parlamentares` e
   `http://localhost:3001/votacoes`:

   ```bash
   node apps/api/dist/main.js
   ```

   ```bash
   API_URL=http://localhost:3000 pnpm --filter @prometeu/web exec next start -p 3001
   ```

### Painel de curadoria

O Keycloak sobe junto com o Docker, com usuários de exemplo (`curadora`, `revisor`, `editora`, senha
`desenvolvimento`; ver [infra/docker/keycloak](infra/docker/keycloak/README.md)). Com o worker e a API no
ar, suba o painel em `http://localhost:3002` (em modo produção ele exige as variáveis `CURADORIA_*`, como
no `.env.example`):

```bash
pnpm --filter @prometeu/curadoria exec next dev -p 3002
```

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
| Roteiro da v1                  | [docs/roadmap.md](docs/roadmap.md)                                                 |
| Visão geral da arquitetura     | [docs/arquitetura/visao-geral.md](docs/arquitetura/visao-geral.md)                 |
| Contextos delimitados (DDD)    | [docs/dominio/mapa-de-contextos.md](docs/dominio/mapa-de-contextos.md)             |
| Linguagem ubíqua (glossário)   | [docs/dominio/linguagem-ubiqua.md](docs/dominio/linguagem-ubiqua.md)               |
| Domínio central: Compromissos  | [docs/dominio/modelo-compromissos.md](docs/dominio/modelo-compromissos.md)         |
| Decisões de arquitetura (ADRs) | [docs/adr/README.md](docs/adr/README.md)                                           |
| Convenções de engenharia       | [docs/engenharia/convencoes.md](docs/engenharia/convencoes.md)                     |
| Pesquisa de mercado            | [docs/pesquisa/concorrentes-e-lacunas.md](docs/pesquisa/concorrentes-e-lacunas.md) |
