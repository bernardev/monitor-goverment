import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';

import type { PessoaNaFonte } from './consulta-de-mandatos-postgres.js';
import { identificadorExterno, mandato, pessoa } from './esquema.js';

/** Parlamentar no exercício do mandato, como os outros contextos o veem. */
export interface ParlamentarEmExercicio {
  readonly pessoaId: string;
  readonly nome: string;
}

/** Serviço de host aberto: quem é a pessoa, pelo código numa fonte oficial. */
export interface ConsultaDePessoas {
  /** O id da pessoa, mesmo que ela não esteja mais no cargo; `undefined` se é desconhecida. */
  porCodigo(pessoa: PessoaNaFonte): Promise<string | undefined>;
  /** Deputados federais e senadores que exerceram mandato em algum momento entre `de` e `ate`. */
  parlamentaresEmExercicio(de: Date, ate: Date): Promise<ParlamentarEmExercicio[]>;
}

export class ConsultaDePessoasPostgres implements ConsultaDePessoas {
  constructor(private readonly banco: BancoDoContexto) {}

  async porCodigo(pessoa: PessoaNaFonte): Promise<string | undefined> {
    const [linha] = await this.banco.drizzle
      .select({ pessoaId: identificadorExterno.pessoaId })
      .from(identificadorExterno)
      .where(
        and(
          eq(identificadorExterno.fonte, pessoa.fonte),
          eq(identificadorExterno.codigo, pessoa.codigo),
        ),
      );
    return linha?.pessoaId;
  }

  async parlamentaresEmExercicio(de: Date, ate: Date): Promise<ParlamentarEmExercicio[]> {
    return this.banco.drizzle
      .selectDistinct({ pessoaId: pessoa.id, nome: pessoa.nome })
      .from(mandato)
      .innerJoin(pessoa, eq(pessoa.id, mandato.pessoaId))
      .where(
        and(
          inArray(mandato.cargo, ['deputado_federal', 'senador']),
          lte(mandato.inicio, ate),
          or(isNull(mandato.fim), gte(mandato.fim, de)),
        ),
      );
  }
}
