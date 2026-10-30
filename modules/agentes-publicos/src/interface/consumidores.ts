import type { DadosLoteIngerido } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import type { ResumoDaImportacao } from '../infrastructure/resumo-da-importacao.js';

export const CONSUMIDOR_DA_CAMARA = 'agentes_publicos.importar_deputados_da_camara';
export const CONSUMIDOR_DO_SENADO = 'agentes_publicos.importar_senadores_do_senado';

interface Importador {
  importar(loteId: string): Promise<ResumoDaImportacao>;
}

export interface Importadores {
  readonly deputados: Importador;
  readonly senadores: Importador;
}

/** Importa cada lote de deputados e de senadores que a plataforma de dados grava na prata (ADR-0005). */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  importadores: Importadores,
  aoImportar: (resumo: ResumoDaImportacao) => void,
): Promise<void> {
  const assinatura = (consumidor: string, fonte: string, tabela: string, importador: Importador) =>
    barramento.assinar(
      'LoteIngerido',
      consumidor,
      consumidorIdempotente(banco, inbox, consumidor, async (envelope) => {
        const lote = envelope.dados as unknown as DadosLoteIngerido;
        if (lote.fonte !== fonte || lote.tabela !== tabela) return;
        aoImportar(await importador.importar(envelope.id));
      }),
    );
  await assinatura(CONSUMIDOR_DA_CAMARA, 'camara', 'camara_deputado', importadores.deputados);
  await assinatura(CONSUMIDOR_DO_SENADO, 'senado', 'senado_senador', importadores.senadores);
}
