import { type DomainError, Result } from '@prometeu/shared-kernel';

import { CuradorId } from '../../domain/identificadores.js';
import { type FonteInput, alterarPromessa, lerFonte, lerId } from '../entrada.js';
import type { PromessaRepository, Relogio } from '../portas.js';

export interface AdicionarFonteInput {
  readonly promessaId: string;
  readonly fonte: FonteInput;
  readonly adicionadaPor: string;
}

export interface AdicionarFonteOutput {
  readonly fonteId: string;
}

/** Ex.: a mesma promessa do plano de governo repetida num debate. */
export class AdicionarFonte {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: AdicionarFonteInput): Promise<Result<AdicionarFonteOutput, DomainError>> {
    const fonte = lerFonte(input.fonte);
    if (!fonte.ok) return fonte;
    const adicionadaPor = lerId(CuradorId.de, input.adicionadaPor, 'adicionadaPor');
    if (!adicionadaPor.ok) return adicionadaPor;

    return alterarPromessa(this.promessas, input.promessaId, (promessa) => {
      const fonteId = promessa.adicionarFonte(
        fonte.value,
        adicionadaPor.value,
        this.relogio.agora(),
      );
      return fonteId.ok ? Result.ok({ fonteId: fonteId.value.valor }) : fonteId;
    });
  }
}
