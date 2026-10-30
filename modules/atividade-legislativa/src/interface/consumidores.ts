import type { DadosLoteIngerido } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import { inbox } from '../infrastructure/esquema.js';
import type { ResumoDaImportacao } from '../infrastructure/resumo-da-importacao.js';

export const CONSUMIDOR_DA_FREQUENCIA = 'atividade_legislativa.importar_frequencia_da_camara';
export const CONSUMIDOR_DAS_VOTACOES = 'atividade_legislativa.importar_votacoes_da_camara';
export const CONSUMIDOR_DAS_VOTACOES_DO_SENADO =
  'atividade_legislativa.importar_votacoes_do_senado';
export const CONSUMIDOR_DAS_PROPOSICOES = 'atividade_legislativa.importar_proposicoes_da_camara';
export const CONSUMIDOR_DAS_PROPOSICOES_DO_SENADO =
  'atividade_legislativa.importar_proposicoes_do_senado';

interface Importador {
  importar(loteId: string): Promise<ResumoDaImportacao>;
}

export interface Importadores {
  readonly frequencia: Importador;
  readonly votacoes: Importador;
  readonly votacoesDoSenado: Importador;
  readonly proposicoes: Importador;
  readonly proposicoesDoSenado: Importador;
}

/** Importa cada lote que a plataforma de dados grava nas tabelas prata deste contexto (ADR-0005). */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  importadores: Importadores,
  aoImportar: (resumo: ResumoDaImportacao) => void,
): Promise<void> {
  const assinaturas: readonly [string, string, string, Importador][] = [
    [CONSUMIDOR_DA_FREQUENCIA, 'camara', 'camara_frequencia_dia', importadores.frequencia],
    [CONSUMIDOR_DAS_VOTACOES, 'camara', 'camara_votacao', importadores.votacoes],
    [CONSUMIDOR_DAS_VOTACOES_DO_SENADO, 'senado', 'senado_votacao', importadores.votacoesDoSenado],
    [CONSUMIDOR_DAS_PROPOSICOES, 'camara', 'camara_proposicao', importadores.proposicoes],
    [
      CONSUMIDOR_DAS_PROPOSICOES_DO_SENADO,
      'senado',
      'senado_processo',
      importadores.proposicoesDoSenado,
    ],
  ];
  for (const [consumidor, fonte, tabela, importador] of assinaturas) {
    await barramento.assinar(
      'LoteIngerido',
      consumidor,
      consumidorIdempotente(banco, inbox, consumidor, async (envelope) => {
        const lote = envelope.dados as unknown as DadosLoteIngerido;
        if (lote.fonte !== fonte || lote.tabela !== tabela) return;
        aoImportar(await importador.importar(envelope.id));
      }),
    );
  }
}
