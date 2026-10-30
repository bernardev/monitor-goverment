import { AsyncLocalStorage } from 'node:async_hooks';

import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';

/** Banco ou transação: quem executa comandos no schema do contexto. */
export type Executor = PgDatabase<NodePgQueryResultHKT>;

/**
 * Acesso ao schema de um contexto, com o usuário de banco desse contexto (ADR-0006).
 *
 * A transação aberta por `transacao()` fica guardada em `AsyncLocalStorage` (ADR-0015): repositórios
 * chamados dentro dela usam `executor` e participam da mesma transação sem que a aplicação saiba.
 */
export class BancoDoContexto {
  private readonly transacaoAtual = new AsyncLocalStorage<Executor>();
  private readonly db: Executor;

  private constructor(
    readonly schema: string,
    private readonly pool: pg.Pool,
  ) {
    this.db = drizzle({ client: pool });
  }

  static conectar(schema: string, url: string, maximoDeConexoes = 10): BancoDoContexto {
    return new BancoDoContexto(
      schema,
      new pg.Pool({ connectionString: url, max: maximoDeConexoes, application_name: schema }),
    );
  }

  /** A transação em curso, ou o banco quando não há transação. */
  get executor(): Executor {
    return this.transacaoAtual.getStore() ?? this.db;
  }

  /** Abre uma transação, ou reaproveita a que já está em curso neste contexto. */
  transacao<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
    const emCurso = this.transacaoAtual.getStore();
    if (emCurso) return fn(emCurso);
    return this.db.transaction((tx) => this.transacaoAtual.run(tx, () => fn(tx)));
  }

  /** Drizzle de leitura e migração; prefira `executor` em repositórios. */
  get drizzle(): Executor {
    return this.db;
  }

  async fechar(): Promise<void> {
    await this.pool.end();
  }
}
