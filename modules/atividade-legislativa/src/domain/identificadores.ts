import type { DomainError } from '@prometeu/shared-kernel';
import { Identificador, Result, gerarUuidV7 } from '@prometeu/shared-kernel';

export class RegistroDeFrequenciaId extends Identificador {
  declare private readonly marca: 'RegistroDeFrequenciaId';

  static gerar(): RegistroDeFrequenciaId {
    return new RegistroDeFrequenciaId(gerarUuidV7());
  }

  static de(valor: string): Result<RegistroDeFrequenciaId, DomainError> {
    const validado = RegistroDeFrequenciaId.validar(valor);
    return validado.ok ? Result.ok(new RegistroDeFrequenciaId(validado.value)) : validado;
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

/** Mandato do contexto Agentes Públicos. Só referenciado, nunca criado aqui. */
export class MandatoId extends Identificador {
  declare private readonly marca: 'MandatoId';

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

export class VotacaoNominalId extends Identificador {
  declare private readonly marca: 'VotacaoNominalId';

  static gerar(): VotacaoNominalId {
    return new VotacaoNominalId(gerarUuidV7());
  }

  static de(valor: string): Result<VotacaoNominalId, DomainError> {
    const validado = VotacaoNominalId.validar(valor);
    return validado.ok ? Result.ok(new VotacaoNominalId(validado.value)) : validado;
  }
}
