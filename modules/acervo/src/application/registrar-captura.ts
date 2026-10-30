import { type DomainError, Result } from '@prometeu/shared-kernel';

import { Captura } from '../domain/captura.js';
import { HashSha256 } from '../domain/hash-sha256.js';
import type { CapturaRepository, Relogio } from './portas.js';

export interface RegistrarCapturaInput {
  readonly fonte: string;
  readonly url: string;
  readonly coletadaEm: Date;
  readonly sha256: string;
  readonly caminho: string;
  readonly tipoDeConteudo: string;
}

export interface RegistrarCapturaOutput {
  readonly capturaId: string;
  /** `false` quando a captura já existia: o mesmo conteúdo devolve sempre o mesmo id. */
  readonly nova: boolean;
}

/**
 * Registra a prova de uma resposta guardada no armazenamento de objetos. Idempotente pelo hash
 * (ADR-0016): importadores podem repetir a chamada sem criar capturas duplicadas.
 */
export class RegistrarCaptura {
  constructor(
    private readonly capturas: CapturaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    input: RegistrarCapturaInput,
  ): Promise<Result<RegistrarCapturaOutput, DomainError>> {
    const sha256 = HashSha256.de(input.sha256);
    if (!sha256.ok) return sha256;

    const existente = await this.capturas.buscarPorHash(sha256.value);
    if (existente) return Result.ok({ capturaId: existente.id.valor, nova: false });

    const captura = Captura.registrar({ ...input, sha256: sha256.value }, this.relogio.agora());
    if (!captura.ok) return captura;
    await this.capturas.salvar(captura.value);
    return Result.ok({ capturaId: captura.value.id.valor, nova: true });
  }
}
