import type { DadosLoteIngerido } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import type {
  ImportadorDeDeputadosDaCamara,
  ResumoDaImportacao,
} from '../infrastructure/importador-de-deputados-da-camara.js';

export const CONSUMIDOR_DA_CAMARA = 'agentes_publicos.importar_deputados_da_camara';

/** Importa cada lote de deputados que a plataforma de dados grava na prata (ADR-0005). */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  importador: ImportadorDeDeputadosDaCamara,
  aoImportar: (resumo: ResumoDaImportacao) => void,
): Promise<void> {
  await barramento.assinar(
    'LoteIngerido',
    CONSUMIDOR_DA_CAMARA,
    consumidorIdempotente(banco, inbox, CONSUMIDOR_DA_CAMARA, async (envelope) => {
      const lote = envelope.dados as unknown as DadosLoteIngerido;
      if (lote.fonte !== 'camara' || lote.tabela !== 'camara_deputado') return;
      aoImportar(await importador.importar(envelope.id));
    }),
  );
}
