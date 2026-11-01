import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, eq } from 'drizzle-orm';

import type { CidadaoRepository } from '../application/portas.js';
import { Alvo } from '../domain/alvo.js';
import { Cidadao, type CidadaoId } from '../domain/cidadao.js';
import { acompanhamento } from './esquema.js';

export class CidadaoRepositoryPostgres implements CidadaoRepository {
  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(id: CidadaoId): Promise<Cidadao> {
    const linhas = await this.banco.executor
      .select()
      .from(acompanhamento)
      .where(eq(acompanhamento.cidadaoId, id.valor));
    return Cidadao.reconstituir(
      id,
      linhas.flatMap((l) => {
        // Gravado por este repositório; um alvo que não se lê mais (tipo retirado) só some da lista.
        const alvo = Alvo.criar(l.tipo, l.alvoId);
        return alvo.ok ? [{ alvo: alvo.value, desde: l.desde }] : [];
      }),
    );
  }

  /** Grava só o que mudou: duas abas ao mesmo tempo não desfazem uma a outra nem duplicam nada. */
  async salvar(cidadao: Cidadao): Promise<void> {
    const id = cidadao.id.valor;
    const { incluidos, retirados } = cidadao.pullAlteracoes();
    await this.banco.transacao(async (tx) => {
      for (const alvo of retirados) {
        await tx
          .delete(acompanhamento)
          .where(
            and(
              eq(acompanhamento.cidadaoId, id),
              eq(acompanhamento.tipo, alvo.tipo),
              eq(acompanhamento.alvoId, alvo.id),
            ),
          );
      }
      if (incluidos.length === 0) return;
      await tx
        .insert(acompanhamento)
        .values(
          incluidos.map((a) => ({
            cidadaoId: id,
            tipo: a.alvo.tipo,
            alvoId: a.alvo.id,
            desde: a.desde,
          })),
        )
        .onConflictDoNothing();
    });
  }

  async apagar(id: CidadaoId): Promise<void> {
    await this.banco.executor.delete(acompanhamento).where(eq(acompanhamento.cidadaoId, id.valor));
  }
}
