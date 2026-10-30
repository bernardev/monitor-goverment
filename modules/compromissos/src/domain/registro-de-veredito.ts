import { Entity } from '@prometeu/shared-kernel';

import { type CapturaId, type CuradorId, RegistroDeVereditoId } from './identificadores.js';
import type { FundamentoDeNaoCumprimento, PropostaDeVeredito } from './proposta-de-veredito.js';
import type { Veredito } from './veredito.js';

/**
 * Veredito publicado. O histórico é append-only (invariante 5): um registro nunca muda nem some;
 * corrigir é publicar outro que aponta para este em `corrige`.
 */
export interface Revisao {
  readonly revisadoPor: CuradorId;
  readonly publicadoEm: Date;
  readonly corrige: RegistroDeVereditoId | undefined;
}

export class RegistroDeVeredito extends Entity<RegistroDeVereditoId> {
  private constructor(
    id: RegistroDeVereditoId,
    private readonly proposta: PropostaDeVeredito,
    private readonly revisao: Revisao,
  ) {
    super(id);
  }

  static publicar(
    proposta: PropostaDeVeredito,
    revisadoPor: CuradorId,
    publicadoEm: Date,
    corrige: RegistroDeVereditoId | undefined,
  ): RegistroDeVeredito {
    return new RegistroDeVeredito(RegistroDeVereditoId.gerar(), proposta, {
      revisadoPor,
      publicadoEm: new Date(publicadoEm),
      corrige,
    });
  }

  static reconstituir(
    id: RegistroDeVereditoId,
    proposta: PropostaDeVeredito,
    revisao: Revisao,
  ): RegistroDeVeredito {
    return new RegistroDeVeredito(id, proposta, revisao);
  }

  /** A proposta que foi revisada e publicada. */
  get propostaPublicada(): PropostaDeVeredito {
    return this.proposta;
  }

  get veredito(): Veredito {
    return this.proposta.veredito;
  }

  get justificativa(): string {
    return this.proposta.justificativa;
  }

  get evidencias(): readonly CapturaId[] {
    return this.proposta.evidencias;
  }

  get fundamento(): FundamentoDeNaoCumprimento | undefined {
    return this.proposta.fundamento;
  }

  get propostoPor(): CuradorId {
    return this.proposta.propostoPor;
  }

  get revisadoPor(): CuradorId {
    return this.revisao.revisadoPor;
  }

  get publicadoEm(): Date {
    return new Date(this.revisao.publicadoEm);
  }

  get corrige(): RegistroDeVereditoId | undefined {
    return this.revisao.corrige;
  }
}
