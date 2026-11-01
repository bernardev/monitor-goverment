import type { AutorNoMunicipio, MunicipioResumo } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { asc, eq, like, sql } from 'drizzle-orm';

import type { ConsultaDeMunicipios } from '../application/portas.js';
import { paraBusca } from './busca.js';
import { emenda, municipio, parlamentar } from './esquema.js';

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

  async autoresDeEmendas(codigoIbge: string): Promise<AutorNoMunicipio[]> {
    if (!/^\d{7}$/.test(codigoIbge)) return [];
    // Uma linha por destinação ao município; a emenda que também foi para outras cidades só
    // contribui com a parte que veio para cá.
    const linhas = await this.banco.drizzle.execute<{
      pessoa_id: string | null;
      nome: string;
      sigla_partido: string | null;
      cargo: string | null;
      emendas: number;
      empenhado: string;
      pago: string;
    }>(sql`
      SELECT ${emenda.autorPessoaId} AS pessoa_id,
             coalesce(min(${parlamentar.nome}), min(${emenda.autorNome})) AS nome,
             min(${parlamentar.siglaPartido}) AS sigla_partido,
             min(${parlamentar.cargo}) AS cargo,
             count(DISTINCT ${emenda.emendaId})::int AS emendas,
             sum((d->>'empenhadoCentavos')::bigint)::text AS empenhado,
             sum((d->>'pagoCentavos')::bigint + (d->>'restosPagosCentavos')::bigint)::text AS pago
      FROM ${emenda}
      CROSS JOIN LATERAL jsonb_array_elements(${emenda.destinacoes}) AS d
      LEFT JOIN ${parlamentar} ON ${parlamentar.pessoaId} = ${emenda.autorPessoaId}
      WHERE ${emenda.municipios} @> ARRAY[${codigoIbge}]::text[]
        AND d->>'municipioIbge' = ${codigoIbge}
      GROUP BY ${emenda.autorPessoaId}, CASE WHEN ${emenda.autorPessoaId} IS NULL THEN ${emenda.autorNome} END
      ORDER BY sum((d->>'pagoCentavos')::bigint + (d->>'restosPagosCentavos')::bigint) DESC,
               sum((d->>'empenhadoCentavos')::bigint) DESC,
               2
    `);
    return linhas.rows.map((l) => ({
      pessoaId: l.pessoa_id,
      nome: l.nome,
      siglaPartido: l.sigla_partido,
      cargo: l.cargo,
      emendas: l.emendas,
      empenhadoCentavos: l.empenhado,
      pagoCentavos: l.pago,
    }));
  }
}
