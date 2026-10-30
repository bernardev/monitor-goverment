import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';

import type { BancoDoContexto } from './banco.js';

/**
 * Aplica as migrações geradas pelo drizzle-kit com o usuário do próprio contexto (ADR-0015), com o
 * controle em `<schema>.__migracoes`.
 *
 * Não usa o migrador do Drizzle porque ele sempre executa `CREATE SCHEMA IF NOT EXISTS`, e o
 * PostgreSQL exige permissão de criar schemas no banco mesmo quando o schema já existe. Os usuários
 * dos contextos não têm essa permissão (ADR-0006); o schema nasce em infra/docker/postgres.
 */
export async function migrar(banco: BancoDoContexto, pastaDasMigracoes: string): Promise<void> {
  const migracoes = readMigrationFiles({ migrationsFolder: pastaDasMigracoes });
  const controle = sql.identifier(banco.schema);
  await banco.transacao(async (tx) => {
    // Duas instâncias subindo ao mesmo tempo não aplicam a mesma migração duas vezes.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${banco.schema}))`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS ${controle}.__migracoes (
        id serial PRIMARY KEY,
        hash text NOT NULL,
        criada_em bigint NOT NULL,
        aplicada_em timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await tx.execute<{ criada_em: string }>(
      sql`SELECT criada_em FROM ${controle}.__migracoes ORDER BY criada_em DESC LIMIT 1`,
    );
    const ultimaAplicada = rows[0] ? Number(rows[0].criada_em) : -1;
    for (const migracao of migracoes) {
      if (migracao.folderMillis <= ultimaAplicada) continue;
      for (const comando of migracao.sql) {
        if (comando.trim().length > 0) await tx.execute(sql.raw(comando));
      }
      await tx.execute(
        sql`INSERT INTO ${controle}.__migracoes (hash, criada_em) VALUES (${migracao.hash}, ${migracao.folderMillis})`,
      );
    }
  });
}
