import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { Dinheiro } from '@prometeu/shared-kernel';
import { and, eq } from 'drizzle-orm';

import type { ObraRepository } from '../application/portas.js';
import { CapturaId, ObraId } from '../domain/identificadores.js';
import { Obra } from '../domain/obra.js';
import { INTERRUPCOES, SITUACOES_DA_OBRA } from '../domain/situacao-da-obra.js';
import { type ApuracaoGravada, obra, outbox } from './esquema.js';
import { ConflitoDeConcorrencia, confiavel, conhecido } from './persistencia.js';

export class ObraRepositoryPostgres implements ObraRepository {
  /** Versão lida de cada obra carregada por este repositório. */
  private readonly versoes = new WeakMap<Obra, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(idNaFonte: string): Promise<Obra | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(obra)
      .where(eq(obra.idNaFonte, idNaFonte));
    if (!linha) return undefined;
    const encontrada = paraObra(linha);
    this.versoes.set(encontrada, linha.versao);
    return encontrada;
  }

  salvar(alvo: Obra): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const a = alvo.apuracao;
      const apuracao: ApuracaoGravada = {
        ...a,
        municipios: a.municipios.map((m) => ({ ...m })),
        pontos: a.pontos.map((p) => ({ ...p })),
        executores: a.executores.map((e) => ({ ...e })),
        medicao: a.medicao === null ? null : { ...a.medicao },
        interrupcoes: a.interrupcoes.map((i) => ({ ...i })),
        investimentoPrevisto: a.investimentoPrevisto.centavos.toString(),
        emendas: a.emendas.map((e) => ({ ...e, empenhado: e.empenhado.centavos.toString() })),
      };
      const dados = { apuracao, capturaId: alvo.captura.valor };
      if (versaoLida === undefined) {
        await tx
          .insert(obra)
          .values({ id: alvo.id.valor, idNaFonte: alvo.idNaFonte, ...dados, versao: 1 });
      } else {
        const atualizadas = await tx
          .update(obra)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(and(eq(obra.id, alvo.id.valor), eq(obra.versao, versaoLida)))
          .returning({ id: obra.id });
        if (atualizadas.length === 0) {
          throw new ConflitoDeConcorrencia(`A obra ${alvo.id.valor}`);
        }
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraObra(linha: typeof obra.$inferSelect): Obra {
  const a = linha.apuracao;
  const real = (centavos: string) => confiavel(Dinheiro.deCentavos(BigInt(centavos)));
  return Obra.reconstituir(confiavel(ObraId.de(linha.id)), {
    idNaFonte: linha.idNaFonte,
    apuracao: {
      ...a,
      situacao: conhecido(SITUACOES_DA_OBRA, a.situacao, 'situação da obra'),
      investimentoPrevisto: real(a.investimentoPrevisto),
      interrupcoes: a.interrupcoes.map((i) => ({
        ...i,
        tipo: conhecido(INTERRUPCOES, i.tipo, 'interrupção da obra'),
      })),
      emendas: a.emendas.map((e) => ({ ...e, empenhado: real(e.empenhado) })),
    },
    captura: confiavel(CapturaId.de(linha.capturaId)),
  });
}
