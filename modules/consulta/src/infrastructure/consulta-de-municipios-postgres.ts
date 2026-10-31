import type { MunicipioResumo } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { asc, eq, like, sql } from 'drizzle-orm';

import type { ConsultaDeMunicipios } from '../application/portas.js';
import { paraBusca } from './busca.js';
import { municipio } from './esquema.js';

export class ConsultaDeMunicipiosPostgres implements ConsultaDeMunicipios {
  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(nome: string): Promise<MunicipioResumo[]> {
    const termo = paraBusca(nome);
    if (termo.length < 2) return [];
    return this.banco.drizzle
      .select({ codigoIbge: municipio.codigoIbge, nome: municipio.nome, uf: municipio.uf })
      .from(municipio)
      .where(like(municipio.nomeBusca, `%${termo}%`))
      .orderBy(
        // Quem começa com o termo vem antes de quem só o contém.
        sql`${municipio.nomeBusca} like ${`${termo}%`} desc`,
        asc(municipio.nomeBusca),
        asc(municipio.uf),
      )
      .limit(20);
  }

  async porCodigo(codigoIbge: string): Promise<MunicipioResumo | undefined> {
    if (!/^\d{7}$/.test(codigoIbge)) return undefined;
    const [encontrado] = await this.banco.drizzle
      .select({ codigoIbge: municipio.codigoIbge, nome: municipio.nome, uf: municipio.uf })
      .from(municipio)
      .where(eq(municipio.codigoIbge, codigoIbge));
    return encontrado;
  }
}
