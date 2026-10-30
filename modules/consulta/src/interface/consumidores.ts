import type { EnvelopeDeEvento } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import {
  EVENTOS_DE_EMENDA,
  type ProjetorDeEmendas,
} from '../infrastructure/projetor-de-emendas.js';
import {
  EVENTOS_DE_FREQUENCIA,
  type ProjetorDeFrequencia,
} from '../infrastructure/projetor-de-frequencia.js';
import {
  EVENTOS_PROJETADOS,
  type ProjetorDeParlamentares,
} from '../infrastructure/projetor-de-parlamentares.js';
import {
  EVENTOS_DE_PROPOSICAO,
  type ProjetorDeProposicoes,
} from '../infrastructure/projetor-de-proposicoes.js';
import {
  EVENTOS_DE_VOTACAO,
  type ProjetorDeVotacoes,
} from '../infrastructure/projetor-de-votacoes.js';

export const CONSUMIDOR_DE_PARLAMENTARES = 'consulta.projetar_parlamentares';
export const CONSUMIDOR_DE_FREQUENCIA = 'consulta.projetar_frequencia';
export const CONSUMIDOR_DE_VOTACOES = 'consulta.projetar_votacoes';
export const CONSUMIDOR_DE_PROPOSICOES = 'consulta.projetar_proposicoes';
export const CONSUMIDOR_DE_EMENDAS = 'consulta.projetar_emendas';

export interface Projetores {
  readonly parlamentares: ProjetorDeParlamentares;
  readonly frequencia: ProjetorDeFrequencia;
  readonly votacoes: ProjetorDeVotacoes;
  readonly proposicoes: ProjetorDeProposicoes;
  readonly emendas: ProjetorDeEmendas;
}

interface Projetor {
  aplicar(envelope: EnvelopeDeEvento): Promise<void>;
}

/** Cada projeção é um consumidor idempotente dos eventos que acompanha (ADR-0008). */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  projetores: Projetores,
): Promise<void> {
  const assinaturas: readonly [string, readonly string[], Projetor][] = [
    [CONSUMIDOR_DE_PARLAMENTARES, EVENTOS_PROJETADOS, projetores.parlamentares],
    [CONSUMIDOR_DE_FREQUENCIA, EVENTOS_DE_FREQUENCIA, projetores.frequencia],
    [CONSUMIDOR_DE_VOTACOES, EVENTOS_DE_VOTACAO, projetores.votacoes],
    [CONSUMIDOR_DE_PROPOSICOES, EVENTOS_DE_PROPOSICAO, projetores.proposicoes],
    [CONSUMIDOR_DE_EMENDAS, EVENTOS_DE_EMENDA, projetores.emendas],
  ];
  for (const [consumidor, eventos, projetor] of assinaturas) {
    const consumir = consumidorIdempotente(banco, inbox, consumidor, (envelope) =>
      projetor.aplicar(envelope),
    );
    for (const tipo of eventos) await barramento.assinar(tipo, consumidor, consumir);
  }
}
