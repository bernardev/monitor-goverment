import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, eq } from 'drizzle-orm';

import type { PessoaNaFonte } from './consulta-de-mandatos-postgres.js';
import { identificadorExterno } from './esquema.js';

/** Serviço de host aberto: quem é a pessoa, pelo código numa fonte oficial. */
export interface ConsultaDePessoas {
  /** O id da pessoa, mesmo que ela não esteja mais no cargo; `undefined` se é desconhecida. */
  porCodigo(pessoa: PessoaNaFonte): Promise<string | undefined>;
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
}
