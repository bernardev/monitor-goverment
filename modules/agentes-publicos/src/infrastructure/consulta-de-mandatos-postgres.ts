import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type { Cargo } from '../domain/cargo.js';
import { mandato } from './esquema.js';

/** Mandato como os outros contextos o veem (linguagem publicada, serviço de host aberto). */
export interface MandatoPublicado {
  readonly mandatoId: string;
  readonly pessoaId: string;
  readonly cargo: Cargo;
  /** Código IBGE do ente que elege o cargo. */
  readonly circunscricao: string;
  readonly inicio: Date;
  /** `null`: mandato sem data de término conhecida. */
  readonly fim: Date | null;
}

export interface ConsultaDeMandatos {
  buscar(mandatoId: string): Promise<MandatoPublicado | undefined>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ConsultaDeMandatosPostgres implements ConsultaDeMandatos {
  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(mandatoId: string): Promise<MandatoPublicado | undefined> {
    if (!UUID.test(mandatoId)) return undefined;
    const [linha] = await this.banco.drizzle
      .select()
      .from(mandato)
      .where(eq(mandato.id, mandatoId.toLowerCase()));
    if (!linha) return undefined;
    return {
      mandatoId: linha.id,
      pessoaId: linha.pessoaId,
      cargo: linha.cargo as Cargo,
      circunscricao: linha.circunscricao,
      inicio: linha.inicio,
      fim: linha.fim,
    };
  }
}
