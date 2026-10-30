import type { DomainError } from '@prometeu/shared-kernel';
import { Identificador, Result, gerarUuidV7 } from '@prometeu/shared-kernel';

export class PessoaId extends Identificador {
  declare private readonly marca: 'PessoaId';

  static gerar(): PessoaId {
    return new PessoaId(gerarUuidV7());
  }

  static de(valor: string): Result<PessoaId, DomainError> {
    const validado = PessoaId.validar(valor);
    return validado.ok ? Result.ok(new PessoaId(validado.value)) : validado;
  }
}

export class MandatoId extends Identificador {
  declare private readonly marca: 'MandatoId';

  static gerar(): MandatoId {
    return new MandatoId(gerarUuidV7());
  }

  static de(valor: string): Result<MandatoId, DomainError> {
    const validado = MandatoId.validar(valor);
    return validado.ok ? Result.ok(new MandatoId(validado.value)) : validado;
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
