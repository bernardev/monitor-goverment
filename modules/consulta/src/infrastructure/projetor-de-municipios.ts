import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { EmendaPublicada } from '@prometeu/financas-publicas';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import type { ObraPublicada } from '@prometeu/obras';
import { CodigoIbge } from '@prometeu/shared-kernel';
import { sql } from 'drizzle-orm';

import { municipio } from './esquema.js';
import { EVENTOS_DE_EMENDA } from './projetor-de-emendas.js';
import { EVENTOS_DE_OBRA } from './projetor-de-obras.js';

export const EVENTOS_DE_MUNICIPIO = [...EVENTOS_DE_EMENDA, ...EVENTOS_DE_OBRA] as const;

/**
 * Mantém a projeção `municipio` com os municípios que aparecem nas emendas (destino) e nas obras
 * (local). A emenda escreve o nome em maiúsculas na localidade (`SÃO PAULO - SP`); a obra, com
 * minúsculas (`São Paulo`), que fica quando aparece.
 */
export class ProjetorDeMunicipios {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const encontrados = new Map<string, string>();
    if (envelope.tipo.startsWith('Obra')) {
      const obra = envelope.dados as unknown as ObraPublicada;
      for (const m of obra.municipios) if (m.nome) encontrados.set(m.codigoIbge, m.nome);
    } else {
      const emenda = envelope.dados as unknown as EmendaPublicada;
      for (const d of emenda.destinacoes) {
        // `SÃO PAULO - SP`: o nome é o que vem antes da UF.
        const nome = /^(.+) - [A-Z]{2}$/.exec(d.localidade)?.[1];
        if (d.municipioIbge && nome) encontrados.set(d.municipioIbge, nome);
      }
    }
    for (const [codigoIbge, nome] of encontrados) {
      const uf = CodigoIbge.criar(codigoIbge.slice(0, 2));
      const sigla = uf.ok ? uf.value.uf() : undefined;
      if (sigla === undefined) continue;
      await this.banco.executor
        .insert(municipio)
        .values({ codigoIbge, nome, uf: sigla })
        .onConflictDoUpdate({
          target: municipio.codigoIbge,
          set: { nome },
          setWhere: sql`${municipio.nome} = upper(${municipio.nome}) and ${nome} <> upper(${nome})`,
        });
    }
  }
}
