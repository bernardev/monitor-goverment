import type { DomainError } from '@prometeu/shared-kernel';
import { Identificador, Result, gerarUuidV7 } from '@prometeu/shared-kernel';

export class EmendaId extends Identificador {
  declare private readonly marca: 'EmendaId';

  static gerar(): EmendaId {
    return new EmendaId(gerarUuidV7());
  }

  static de(valor: string): Result<EmendaId, DomainError> {
    const validado = EmendaId.validar(valor);
    return validado.ok ? Result.ok(new EmendaId(validado.value)) : validado;
  }
}

/** Pessoa do contexto Agentes Públicos. Só referenciada, nunca criada aqui. */
export class PessoaId extends Identificador {
  declare private readonly marca: 'PessoaId';

  static de(valor: string): Result<PessoaId, DomainError> {
    const validado = PessoaId.validar(valor);
    return validado.ok ? Result.ok(new PessoaId(validado.value)) : validado;
  }
}

/** Captura do contexto Acervo que prova o dado (ADR-0009). Só referenciada, nunca criada aqui. */
export class CapturaId extends Identificador {
  declare private readonly marca: 'CapturaId';

  static de(valor: string): Result<CapturaId, DomainError> {
    const validado = CapturaId.validar(valor);
    return validado.ok ? Result.ok(new CapturaId(validado.value)) : validado;
  }
}
