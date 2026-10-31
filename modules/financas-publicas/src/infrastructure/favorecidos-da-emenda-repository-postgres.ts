import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { Dinheiro } from '@prometeu/shared-kernel';
import { and, eq } from 'drizzle-orm';

import type { FavorecidosDaEmendaRepository } from '../application/portas.js';
import { FavorecidosDaEmenda } from '../domain/favorecidos-da-emenda.js';
import { TIPOS_DE_FAVORECIDO } from '../domain/tipo-de-favorecido.js';
import { CapturaId, FavorecidosDaEmendaId } from '../domain/identificadores.js';
import { favorecidosDaEmenda, outbox } from './esquema.js';
import { ConflitoDeConcorrencia, confiavel, conhecido } from './persistencia.js';

export class FavorecidosDaEmendaRepositoryPostgres implements FavorecidosDaEmendaRepository {
  /** Versão lida de cada lista carregada por este repositório. */
  private readonly versoes = new WeakMap<FavorecidosDaEmenda, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(codigoDaEmenda: string): Promise<FavorecidosDaEmenda | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(favorecidosDaEmenda)
      .where(eq(favorecidosDaEmenda.codigoDaEmenda, codigoDaEmenda));
    if (!linha) return undefined;
    const encontrados = paraFavorecidos(linha);
    this.versoes.set(encontrados, linha.versao);
    return encontrados;
  }

  salvar(alvo: FavorecidosDaEmenda): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const dados = {
        recebimentos: alvo.recebimentos.map((r) => ({
          mes: r.mes,
          favorecido: { ...r.favorecido },
          quantidade: r.quantidade,
          valor: r.valor.centavos.toString(),
        })),
        capturaId: alvo.captura.valor,
      };
      if (versaoLida === undefined) {
        await tx.insert(favorecidosDaEmenda).values({
          id: alvo.id.valor,
          codigoDaEmenda: alvo.codigoDaEmenda,
          ...dados,
          versao: 1,
        });
      } else {
        const atualizadas = await tx
          .update(favorecidosDaEmenda)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(
            and(
              eq(favorecidosDaEmenda.id, alvo.id.valor),
              eq(favorecidosDaEmenda.versao, versaoLida),
            ),
          )
          .returning({ id: favorecidosDaEmenda.id });
        if (atualizadas.length === 0) {
          throw new ConflitoDeConcorrencia(`A lista de favorecidos ${alvo.id.valor}`);
        }
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraFavorecidos(linha: typeof favorecidosDaEmenda.$inferSelect): FavorecidosDaEmenda {
  return FavorecidosDaEmenda.reconstituir(confiavel(FavorecidosDaEmendaId.de(linha.id)), {
    codigoDaEmenda: linha.codigoDaEmenda,
    recebimentos: linha.recebimentos.map((r) => ({
      mes: r.mes,
      favorecido: {
        ...r.favorecido,
        tipo: conhecido(TIPOS_DE_FAVORECIDO, r.favorecido.tipo, 'tipo de favorecido'),
      },
      quantidade: r.quantidade,
      valor: confiavel(Dinheiro.deCentavos(BigInt(r.valor))),
    })),
    captura: confiavel(CapturaId.de(linha.capturaId)),
  });
}
