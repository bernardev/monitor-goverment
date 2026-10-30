import type { DadosLoteIngerido } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import type { ImportadorDeEmendasDoPortal } from '../infrastructure/importador-de-emendas-do-portal.js';
import type { ResumoDaImportacao } from '../infrastructure/resumo-da-importacao.js';

export const CONSUMIDOR_DAS_EMENDAS = 'financas_publicas.importar_emendas_do_portal';

/** Importa cada lote de emendas que a plataforma de dados grava na prata (ADR-0005). */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  importador: ImportadorDeEmendasDoPortal,
  aoImportar: (resumo: ResumoDaImportacao) => void,
): Promise<void> {
  await barramento.assinar(
    'LoteIngerido',
    CONSUMIDOR_DAS_EMENDAS,
    consumidorIdempotente(banco, inbox, CONSUMIDOR_DAS_EMENDAS, async (envelope) => {
      const lote = envelope.dados as unknown as DadosLoteIngerido;
      if (lote.fonte !== 'portal_transparencia' || lote.tabela !== 'transparencia_emenda') return;
      aoImportar(await importador.importar(envelope.id));
    }),
  );
}
