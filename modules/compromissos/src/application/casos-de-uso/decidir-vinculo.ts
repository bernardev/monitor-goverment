import type { DomainError, Result } from '@prometeu/shared-kernel';

import { CuradorId, VinculoId } from '../../domain/identificadores.js';
import { alterarPromessa, lerId } from '../entrada.js';
import type { PromessaRepository, Relogio } from '../portas.js';

export interface ConfirmarVinculoInput {
  readonly promessaId: string;
  readonly vinculoId: string;
  readonly confirmadoPor: string;
}

/** Decisão humana que faz o vínculo contar para o estágio da promessa. */
export class ConfirmarVinculo {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: ConfirmarVinculoInput): Promise<Result<void, DomainError>> {
    const vinculo = lerId(VinculoId.de, input.vinculoId, 'vinculoId');
    if (!vinculo.ok) return vinculo;
    const curador = lerId(CuradorId.de, input.confirmadoPor, 'confirmadoPor');
    if (!curador.ok) return curador;

    return alterarPromessa(this.promessas, input.promessaId, (promessa) =>
      promessa.confirmarVinculo(vinculo.value, curador.value, this.relogio.agora()),
    );
  }
}

export interface RejeitarVinculoInput {
  readonly promessaId: string;
  readonly vinculoId: string;
  readonly rejeitadoPor: string;
  readonly motivo: string;
}

/** Recusa uma sugestão ou desfaz uma confirmação (ex.: PL arquivado). */
export class RejeitarVinculo {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: RejeitarVinculoInput): Promise<Result<void, DomainError>> {
    const vinculo = lerId(VinculoId.de, input.vinculoId, 'vinculoId');
    if (!vinculo.ok) return vinculo;
    const curador = lerId(CuradorId.de, input.rejeitadoPor, 'rejeitadoPor');
    if (!curador.ok) return curador;

    return alterarPromessa(this.promessas, input.promessaId, (promessa) =>
      promessa.rejeitarVinculo(vinculo.value, curador.value, input.motivo, this.relogio.agora()),
    );
  }
}
