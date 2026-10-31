import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { Dinheiro } from '@prometeu/shared-kernel';
import { and, eq } from 'drizzle-orm';

import type { ConvenioRepository } from '../application/portas.js';
import { Convenio } from '../domain/convenio.js';
import { CapturaId, ConvenioId } from '../domain/identificadores.js';
import { convenio, outbox } from './esquema.js';
import { ConflitoDeConcorrencia, confiavel } from './persistencia.js';

export class ConvenioRepositoryPostgres implements ConvenioRepository {
  /** Versão lida de cada convênio carregado por este repositório. */
  private readonly versoes = new WeakMap<Convenio, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(numero: string): Promise<Convenio | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(convenio)
      .where(eq(convenio.numero, numero));
    if (!linha) return undefined;
    const encontrado = paraConvenio(linha);
    this.versoes.set(encontrado, linha.versao);
    return encontrado;
  }

  salvar(alvo: Convenio): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const a = alvo.apuracao;
      const dados = {
        convenente: a.convenente,
        objeto: a.objeto,
        publicadoEm: a.publicadoEm,
        valor: a.valor.centavos,
        emendas: a.emendas.map((e) => ({
          codigoDaEmenda: e.codigoDaEmenda,
          funcao: { ...e.funcao },
          subfuncao: { ...e.subfuncao },
          localidade: e.localidade,
        })),
        capturaId: alvo.captura.valor,
      };
      if (versaoLida === undefined) {
        await tx
          .insert(convenio)
          .values({ id: alvo.id.valor, numero: alvo.numero, ...dados, versao: 1 });
      } else {
        const atualizados = await tx
          .update(convenio)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(and(eq(convenio.id, alvo.id.valor), eq(convenio.versao, versaoLida)))
          .returning({ id: convenio.id });
        if (atualizados.length === 0) {
          throw new ConflitoDeConcorrencia(`O convênio ${alvo.id.valor}`);
        }
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraConvenio(linha: typeof convenio.$inferSelect): Convenio {
  return Convenio.reconstituir(confiavel(ConvenioId.de(linha.id)), {
    numero: linha.numero,
    apuracao: {
      convenente: linha.convenente,
      objeto: linha.objeto,
      publicadoEm: linha.publicadoEm,
      valor: confiavel(Dinheiro.deCentavos(linha.valor)),
      emendas: linha.emendas,
    },
    captura: confiavel(CapturaId.de(linha.capturaId)),
  });
}
