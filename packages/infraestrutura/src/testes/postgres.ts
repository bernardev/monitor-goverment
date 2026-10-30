import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/** Mesma imagem e mesmo script de schemas e usuários do ambiente local (infra/docker). */
const IMAGEM = 'pgvector/pgvector:0.8.7-pg18-trixie';
const SCRIPTS_DE_INICIO = fileURLToPath(
  new URL('../../../../infra/docker/postgres', import.meta.url),
);

export interface PostgresDeTeste {
  /** URL com o usuário de um contexto (`ctx_<schema>`), que só escreve no próprio schema. */
  urlDoContexto(schema: string): string;
  /** URL do administrador, para preparar cenários que nenhum contexto poderia montar. */
  readonly urlDoAdministrador: string;
  parar(): Promise<void>;
}

/** Sobe um PostgreSQL descartável com os schemas e usuários de produção (testes de integração). */
export async function iniciarPostgresDeTeste(): Promise<PostgresDeTeste> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(IMAGEM)
    .withDatabase('prometeu')
    .withUsername('prometeu_admin')
    .withPassword('teste')
    .withCopyDirectoriesToContainer([
      { source: SCRIPTS_DE_INICIO, target: '/docker-entrypoint-initdb.d' },
    ])
    .start();
  const endereco = `${container.getHost()}:${container.getPort()}/prometeu`;
  return {
    urlDoContexto: (schema) => `postgres://ctx_${schema}:desenvolvimento@${endereco}`,
    urlDoAdministrador: container.getConnectionUri(),
    parar: async () => {
      await container.stop();
    },
  };
}
