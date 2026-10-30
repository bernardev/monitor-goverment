import { type DomainError, Result } from '@prometeu/shared-kernel';

import { CuradorId } from '../../domain/identificadores.js';
import { alterarPromessa, lerId } from '../entrada.js';
import type { PromessaRepository, Relogio } from '../portas.js';

export interface PublicarVereditoInput {
  readonly promessaId: string;
  readonly revisadoPor: string;
}

export interface PublicarVereditoOutput {
  readonly registroId: string;
}

/** Revisão que aprova a proposta pendente e a torna o veredito vigente. */
export class PublicarVeredito {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    input: PublicarVereditoInput,
  ): Promise<Result<PublicarVereditoOutput, DomainError>> {
    const revisor = lerId(CuradorId.de, input.revisadoPor, 'revisadoPor');
    if (!revisor.ok) return revisor;

    return alterarPromessa(this.promessas, input.promessaId, (promessa) => {
      const registroId = promessa.publicarVeredito(revisor.value, this.relogio.agora());
      return registroId.ok ? Result.ok({ registroId: registroId.value.valor }) : registroId;
    });
  }
}

export interface RecusarVereditoInput {
  readonly promessaId: string;
  readonly recusadoPor: string;
  readonly motivo: string;
}

/** Revisão que devolve a proposta ao curador, com motivo. */
export class RecusarVeredito {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: RecusarVereditoInput): Promise<Result<void, DomainError>> {
    const revisor = lerId(CuradorId.de, input.recusadoPor, 'recusadoPor');
    if (!revisor.ok) return revisor;

    return alterarPromessa(this.promessas, input.promessaId, (promessa) =>
      promessa.recusarVeredito(revisor.value, input.motivo, this.relogio.agora()),
    );
  }
}
