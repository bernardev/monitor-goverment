import type { RegistrarCaptura } from '@prometeu/acervo';
import type { DomainError, Result } from '@prometeu/shared-kernel';

import type { OrigemDoDado, RegistroDeCapturas } from '../application/portas.js';
import { CapturaId } from '../domain/identificadores.js';

/** Chama o serviço de host aberto do Acervo (ADR-0016). */
export class RegistroDeCapturasNoAcervo implements RegistroDeCapturas {
  constructor(private readonly registrarCaptura: RegistrarCaptura) {}

  async registrar(origem: OrigemDoDado): Promise<Result<CapturaId, DomainError>> {
    const registrada = await this.registrarCaptura.execute(origem);
    if (!registrada.ok) return registrada;
    return CapturaId.de(registrada.value.capturaId);
  }
}
