import type { RegistrarCaptura } from '@prometeu/acervo';
import { type DomainError, Result } from '@prometeu/shared-kernel';

import type { OrigemDoDado, RegistroDeCapturas } from '../application/portas.js';
import { CapturaId } from '../domain/identificadores.js';

/** Quantas capturas recentes ficam na memória. */
const LEMBRADAS = 16;

/**
 * Chama o serviço de host aberto do Acervo (ADR-0016). Milhares de emendas vêm do mesmo arquivo: a
 * captura é lembrada pelo hash, o que é seguro porque o Acervo devolve sempre a mesma captura para o
 * mesmo hash.
 */
export class RegistroDeCapturasNoAcervo implements RegistroDeCapturas {
  private readonly recentes = new Map<string, CapturaId>();

  constructor(private readonly registrarCaptura: RegistrarCaptura) {}

  async registrar(origem: OrigemDoDado): Promise<Result<CapturaId, DomainError>> {
    const lembrada = this.recentes.get(origem.sha256);
    if (lembrada) return Result.ok(lembrada);
    const registrada = await this.registrarCaptura.execute(origem);
    if (!registrada.ok) return registrada;
    const captura = CapturaId.de(registrada.value.capturaId);
    if (!captura.ok) return captura;
    this.recentes.set(origem.sha256, captura.value);
    if (this.recentes.size > LEMBRADAS) {
      const [maisAntiga] = this.recentes.keys();
      if (maisAntiga !== undefined) this.recentes.delete(maisAntiga);
    }
    return captura;
  }
}
