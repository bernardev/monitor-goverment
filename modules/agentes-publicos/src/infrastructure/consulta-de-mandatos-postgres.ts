import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';

import type { Cargo } from '../domain/cargo.js';
import type { FonteExterna } from '../domain/identificador-externo.js';
import { identificadorExterno, mandato } from './esquema.js';

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

/** Como uma fonte oficial identifica a pessoa (`camara:204554`). */
export interface PessoaNaFonte {
  readonly fonte: FonteExterna;
  readonly codigo: string;
}

export interface ConsultaDeMandatos {
  buscar(mandatoId: string): Promise<MandatoPublicado | undefined>;
  /**
   * Mandato do cargo que a pessoa exercia em algum instante entre `de` e `ate` (por padrão, só em
   * `de`), achada pelo código na fonte. Se a pessoa saiu e voltou no intervalo, vale o exercício mais
   * recente. Este contexto é o único que traduz códigos das fontes em pessoas (mapa de contextos).
   */
  vigente(
    pessoa: PessoaNaFonte,
    cargo: Cargo,
    de: Date,
    ate?: Date,
  ): Promise<MandatoPublicado | undefined>;
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
    return linha && paraPublicado(linha);
  }

  async vigente(
    pessoa: PessoaNaFonte,
    cargo: Cargo,
    de: Date,
    ate: Date = de,
  ): Promise<MandatoPublicado | undefined> {
    const [linha] = await this.banco.drizzle
      .select({ mandato })
      .from(identificadorExterno)
      .innerJoin(mandato, eq(mandato.pessoaId, identificadorExterno.pessoaId))
      .where(
        and(
          eq(identificadorExterno.fonte, pessoa.fonte),
          eq(identificadorExterno.codigo, pessoa.codigo),
          eq(mandato.cargo, cargo),
          lte(mandato.inicio, ate),
          or(isNull(mandato.fim), gte(mandato.fim, de)),
        ),
      )
      .orderBy(desc(mandato.inicio))
      .limit(1);
    return linha && paraPublicado(linha.mandato);
  }
}

function paraPublicado(linha: typeof mandato.$inferSelect): MandatoPublicado {
  return {
    mandatoId: linha.id,
    pessoaId: linha.pessoaId,
    cargo: linha.cargo as Cargo,
    circunscricao: linha.circunscricao,
    inicio: linha.inicio,
    fim: linha.fim,
  };
}
