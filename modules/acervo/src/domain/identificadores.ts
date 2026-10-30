import type { DomainError } from '@prometeu/shared-kernel';
import { Identificador, Result, gerarUuidV7 } from '@prometeu/shared-kernel';

export class CapturaId extends Identificador {
  declare private readonly marca: 'CapturaId';

  static gerar(): CapturaId {
    return new CapturaId(gerarUuidV7());
  }

  static de(valor: string): Result<CapturaId, DomainError> {
    const validado = CapturaId.validar(valor);
    return validado.ok ? Result.ok(new CapturaId(validado.value)) : validado;
  }
}
