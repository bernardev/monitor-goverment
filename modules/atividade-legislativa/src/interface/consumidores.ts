import type { DadosLoteIngerido } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import type {
  ImportadorDeFrequenciaDaCamara,
  ResumoDaImportacao,
} from '../infrastructure/importador-de-frequencia-da-camara.js';

export const CONSUMIDOR_DA_FREQUENCIA = 'atividade_legislativa.importar_frequencia_da_camara';

/** Importa cada lote de frequência que a plataforma de dados grava na prata (ADR-0005). */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  importador: ImportadorDeFrequenciaDaCamara,
  aoImportar: (resumo: ResumoDaImportacao) => void,
): Promise<void> {
  await barramento.assinar(
    'LoteIngerido',
    CONSUMIDOR_DA_FREQUENCIA,
    consumidorIdempotente(banco, inbox, CONSUMIDOR_DA_FREQUENCIA, async (envelope) => {
      const lote = envelope.dados as unknown as DadosLoteIngerido;
      if (lote.fonte !== 'camara' || lote.tabela !== 'camara_frequencia_dia') return;
      aoImportar(await importador.importar(envelope.id));
    }),
  );
}
