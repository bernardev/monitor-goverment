import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import {
  EVENTOS_PROJETADOS,
  type ProjetorDeParlamentares,
} from '../infrastructure/projetor-de-parlamentares.js';

export const CONSUMIDOR_DE_PARLAMENTARES = 'consulta.projetar_parlamentares';

export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  projetor: ProjetorDeParlamentares,
): Promise<void> {
  const manipulador = consumidorIdempotente(banco, inbox, CONSUMIDOR_DE_PARLAMENTARES, (envelope) =>
    projetor.aplicar(envelope),
  );
  for (const tipo of EVENTOS_PROJETADOS) {
    await barramento.assinar(tipo, CONSUMIDOR_DE_PARLAMENTARES, manipulador);
  }
}
