import type { DadosLoteIngerido } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import type { ResumoDaImportacao } from '../infrastructure/resumo-da-importacao.js';

export const CONSUMIDOR_DAS_EMENDAS = 'financas_publicas.importar_emendas_do_portal';
export const CONSUMIDOR_DOS_FAVORECIDOS = 'financas_publicas.importar_favorecidos_do_portal';
export const CONSUMIDOR_DOS_CONVENIOS = 'financas_publicas.importar_convenios_do_portal';

interface Importador {
  importar(loteId: string): Promise<ResumoDaImportacao>;
}

export interface Importadores {
  readonly emendas: Importador;
  readonly favorecidos: Importador;
  readonly convenios: Importador;
}

/** Importa cada lote do Portal da Transparência que a plataforma de dados grava na prata (ADR-0005). */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  importadores: Importadores,
  aoImportar: (resumo: ResumoDaImportacao) => void,
): Promise<void> {
  const assinaturas: readonly [string, string, Importador][] = [
    [CONSUMIDOR_DAS_EMENDAS, 'transparencia_emenda', importadores.emendas],
    [CONSUMIDOR_DOS_FAVORECIDOS, 'transparencia_emenda_favorecido', importadores.favorecidos],
    [CONSUMIDOR_DOS_CONVENIOS, 'transparencia_emenda_convenio', importadores.convenios],
  ];
  for (const [consumidor, tabela, importador] of assinaturas) {
    await barramento.assinar(
      'LoteIngerido',
      consumidor,
      consumidorIdempotente(banco, inbox, consumidor, async (envelope) => {
        const lote = envelope.dados as unknown as DadosLoteIngerido;
        if (lote.fonte !== 'portal_transparencia' || lote.tabela !== tabela) return;
        aoImportar(await importador.importar(envelope.id));
      }),
    );
  }
}
