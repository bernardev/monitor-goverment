import type { DomainError } from '@prometeu/shared-kernel';
import { Identificador, Result, gerarUuidV7 } from '@prometeu/shared-kernel';

export class ObraId extends Identificador {
  declare private readonly marca: 'ObraId';

  static gerar(): ObraId {
    return new ObraId(gerarUuidV7());
  }

  static de(valor: string): Result<ObraId, DomainError> {
    const validado = ObraId.validar(valor);
    return validado.ok ? Result.ok(new ObraId(validado.value)) : validado;
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
