import type { DadosLoteIngerido } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import type { ImportadorDeObrasDoObrasGov } from '../infrastructure/importador-de-obras-do-obrasgov.js';
import type { ResumoDaImportacao } from '../infrastructure/resumo-da-importacao.js';

export const CONSUMIDOR_DAS_OBRAS = 'obras.importar_obras_do_obrasgov';

/**
 * Importa cada lote de projetos que a plataforma de dados grava na prata (ADR-0005). Os outros lotes
 * da mesma coleta (empenhos, execução, histórico, localização) são gravados na mesma transação e
 * lidos junto com os projetos.
 */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  importador: ImportadorDeObrasDoObrasGov,
  aoImportar: (resumo: ResumoDaImportacao) => void,
): Promise<void> {
  await barramento.assinar(
    'LoteIngerido',
    CONSUMIDOR_DAS_OBRAS,
    consumidorIdempotente(banco, inbox, CONSUMIDOR_DAS_OBRAS, async (envelope) => {
      const lote = envelope.dados as unknown as DadosLoteIngerido;
      if (lote.fonte !== 'obrasgov' || lote.tabela !== 'obrasgov_projeto') return;
      aoImportar(await importador.importar(envelope.id));
    }),
  );
}
