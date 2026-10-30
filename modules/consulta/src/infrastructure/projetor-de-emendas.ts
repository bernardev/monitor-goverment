import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { EmendaPublicada } from '@prometeu/financas-publicas';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { CodigoIbge } from '@prometeu/shared-kernel';
import { lte } from 'drizzle-orm';

import { emenda, type ExecucaoProjetada } from './esquema.js';

/** Eventos que esta projeção acompanha. Todos trazem o estado completo da emenda. */
export const EVENTOS_DE_EMENDA = [
  'EmendaRegistrada',
  'ExecucaoDaEmendaAtualizada',
  'EmendaRetificada',
] as const;

/**
 * Mantém a projeção `emenda` a partir dos eventos de Finanças Públicas, com a execução somada. Vale
 * o evento mais novo: a ordem de chegada não importa, e reaplicar o mesmo evento não muda nada.
 */
export class ProjetorDeEmendas {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as EmendaPublicada;
    const somar = (fase: keyof ExecucaoProjetada) =>
      dados.destinacoes.reduce((soma, d) => soma + BigInt(d[fase]), 0n);
    const estado = {
      codigoNaFonte: dados.codigoNaFonte,
      ano: dados.ano,
      tipo: dados.tipo,
      numero: dados.numero,
      autorPessoaId: dados.autor.pessoaId,
      autorNome: dados.autor.nomeNaFonte,
      ufs: ufsDeDestino(dados.destinacoes),
      destinacoes: dados.destinacoes,
      empenhado: somar('empenhadoCentavos'),
      liquidado: somar('liquidadoCentavos'),
      pago: somar('pagoCentavos'),
      restosInscritos: somar('restosInscritosCentavos'),
      restosCancelados: somar('restosCanceladosCentavos'),
      restosPagos: somar('restosPagosCentavos'),
      capturaId: dados.capturaId,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    await this.banco.executor
      .insert(emenda)
      .values({ emendaId: envelope.idDoAgregado, ...estado })
      .onConflictDoUpdate({
        target: emenda.emendaId,
        set: estado,
        setWhere: lte(emenda.ocorridoEm, estado.ocorridoEm),
      });
  }
}

/** As siglas das UFs de destino, em ordem alfabética. O código IBGE começa pelo da UF. */
function ufsDeDestino(destinacoes: EmendaPublicada['destinacoes']): string[] {
  const ufs = new Set<string>();
  for (const d of destinacoes) {
    const codigo = d.ufIbge ?? d.municipioIbge;
    if (codigo === null) continue;
    const ente = CodigoIbge.criar(codigo.slice(0, 2));
    const uf = ente.ok ? ente.value.uf() : undefined;
    if (uf !== undefined) ufs.add(uf);
  }
  return [...ufs].sort();
}
