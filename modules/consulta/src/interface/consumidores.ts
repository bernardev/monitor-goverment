import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import {
  EVENTOS_DE_FREQUENCIA,
  type ProjetorDeFrequencia,
} from '../infrastructure/projetor-de-frequencia.js';
import {
  EVENTOS_PROJETADOS,
  type ProjetorDeParlamentares,
} from '../infrastructure/projetor-de-parlamentares.js';
import {
  EVENTOS_DE_VOTACAO,
  type ProjetorDeVotacoes,
} from '../infrastructure/projetor-de-votacoes.js';

export const CONSUMIDOR_DE_PARLAMENTARES = 'consulta.projetar_parlamentares';
export const CONSUMIDOR_DE_FREQUENCIA = 'consulta.projetar_frequencia';
export const CONSUMIDOR_DE_VOTACOES = 'consulta.projetar_votacoes';

export interface Projetores {
  readonly parlamentares: ProjetorDeParlamentares;
  readonly frequencia: ProjetorDeFrequencia;
  readonly votacoes: ProjetorDeVotacoes;
}

export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  projetores: Projetores,
): Promise<void> {
  const parlamentares = consumidorIdempotente(
    banco,
    inbox,
    CONSUMIDOR_DE_PARLAMENTARES,
    (envelope) => projetores.parlamentares.aplicar(envelope),
  );
  for (const tipo of EVENTOS_PROJETADOS) {
    await barramento.assinar(tipo, CONSUMIDOR_DE_PARLAMENTARES, parlamentares);
  }
  const frequencia = consumidorIdempotente(banco, inbox, CONSUMIDOR_DE_FREQUENCIA, (envelope) =>
    projetores.frequencia.aplicar(envelope),
  );
  for (const tipo of EVENTOS_DE_FREQUENCIA) {
    await barramento.assinar(tipo, CONSUMIDOR_DE_FREQUENCIA, frequencia);
  }
  const votacoes = consumidorIdempotente(banco, inbox, CONSUMIDOR_DE_VOTACOES, (envelope) =>
    projetores.votacoes.aplicar(envelope),
  );
  for (const tipo of EVENTOS_DE_VOTACAO) {
    await barramento.assinar(tipo, CONSUMIDOR_DE_VOTACOES, votacoes);
  }
}
