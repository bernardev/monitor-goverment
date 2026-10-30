import { type DomainError, Identificador, Result, gerarUuidV7 } from '@prometeu/shared-kernel';

// Cada classe declara uma marca privada. Sem ela, a tipagem estrutural do TypeScript aceitaria um
// PessoaId onde se espera um CapturaId, porque as classes teriam exatamente a mesma forma.

/* Identificadores gerados por este contexto. */

export class PromessaId extends Identificador {
  declare private readonly marca: 'PromessaId';

  static gerar(): PromessaId {
    return new PromessaId(gerarUuidV7());
  }

  static de(valor: string): Result<PromessaId, DomainError> {
    const validado = PromessaId.validar(valor);
    return validado.ok ? Result.ok(new PromessaId(validado.value)) : validado;
  }
}

export class FonteId extends Identificador {
  declare private readonly marca: 'FonteId';

  static gerar(): FonteId {
    return new FonteId(gerarUuidV7());
  }

  static de(valor: string): Result<FonteId, DomainError> {
    const validado = FonteId.validar(valor);
    return validado.ok ? Result.ok(new FonteId(validado.value)) : validado;
  }
}

export class VinculoId extends Identificador {
  declare private readonly marca: 'VinculoId';

  static gerar(): VinculoId {
    return new VinculoId(gerarUuidV7());
  }

  static de(valor: string): Result<VinculoId, DomainError> {
    const validado = VinculoId.validar(valor);
    return validado.ok ? Result.ok(new VinculoId(validado.value)) : validado;
  }
}

export class RegistroDeVereditoId extends Identificador {
  declare private readonly marca: 'RegistroDeVereditoId';

  static gerar(): RegistroDeVereditoId {
    return new RegistroDeVereditoId(gerarUuidV7());
  }

  static de(valor: string): Result<RegistroDeVereditoId, DomainError> {
    const validado = RegistroDeVereditoId.validar(valor);
    return validado.ok ? Result.ok(new RegistroDeVereditoId(validado.value)) : validado;
  }
}

/* Identificadores de outros contextos. Compromissos só guarda a referência, nunca o objeto. */

/** Pessoa do contexto Agentes Públicos. */
export class PessoaId extends Identificador {
  declare private readonly marca: 'PessoaId';

  static de(valor: string): Result<PessoaId, DomainError> {
    const validado = PessoaId.validar(valor);
    return validado.ok ? Result.ok(new PessoaId(validado.value)) : validado;
  }
}

/** Candidatura do contexto Agentes Públicos. */
export class CandidaturaId extends Identificador {
  declare private readonly marca: 'CandidaturaId';

  static de(valor: string): Result<CandidaturaId, DomainError> {
    const validado = CandidaturaId.validar(valor);
    return validado.ok ? Result.ok(new CandidaturaId(validado.value)) : validado;
  }
}

/** Mandato do contexto Agentes Públicos. */
export class MandatoId extends Identificador {
  declare private readonly marca: 'MandatoId';

  static de(valor: string): Result<MandatoId, DomainError> {
    const validado = MandatoId.validar(valor);
    return validado.ok ? Result.ok(new MandatoId(validado.value)) : validado;
  }
}

/** Captura do contexto Acervo: a prova de qualquer fato publicado (ADR-0009). */
export class CapturaId extends Identificador {
  declare private readonly marca: 'CapturaId';

  static de(valor: string): Result<CapturaId, DomainError> {
    const validado = CapturaId.validar(valor);
    return validado.ok ? Result.ok(new CapturaId(validado.value)) : validado;
  }
}

/** Pessoa curadora ou revisora do contexto Editorial. */
export class CuradorId extends Identificador {
  declare private readonly marca: 'CuradorId';

  static de(valor: string): Result<CuradorId, DomainError> {
    const validado = CuradorId.validar(valor);
    return validado.ok ? Result.ok(new CuradorId(validado.value)) : validado;
  }
}

/** Fato de outro contexto ao qual uma promessa se vincula (proposição, emenda, obra...). */
export class IdDoAlvo extends Identificador {
  declare private readonly marca: 'IdDoAlvo';

  static de(valor: string): Result<IdDoAlvo, DomainError> {
    const validado = IdDoAlvo.validar(valor);
    return validado.ok ? Result.ok(new IdDoAlvo(validado.value)) : validado;
  }
}
