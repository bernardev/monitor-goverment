import type { MandatoId, PessoaId } from './identificadores.js';

/** Período de exercício do mandato, informado por Agentes Públicos. */
export interface MandatoVigente {
  readonly mandato: MandatoId;
  readonly pessoa: PessoaId;
  readonly inicio: Date;
  readonly fim: Date | null;
}
