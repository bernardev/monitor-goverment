import type {
  EmendaDaObra,
  ObraDetalhada,
  ObraResumo,
  Pagina,
  SituacaoDaObra,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { CodigoIbge } from '@prometeu/shared-kernel';
import { and, arrayContains, count, desc, eq, inArray, like } from 'drizzle-orm';

import type { ConsultaDeObras, FiltroDeObras } from '../application/portas.js';
import { paraBusca } from './busca.js';
import { captura, emenda, obra } from './esquema.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A de maior investimento primeiro. */
const MAIOR_INVESTIMENTO_PRIMEIRO = [desc(obra.investimentoPrevisto), obra.idNaFonte];

type LinhaDeObra = typeof obra.$inferSelect;
type LinhaDeCaptura = typeof captura.$inferSelect;

export class ConsultaDeObrasPostgres implements ConsultaDeObras {
  constructor(private readonly banco: BancoDoContexto) {}

  async listar(filtro: FiltroDeObras): Promise<Pagina<ObraResumo>> {
    const vazia = { itens: [], pagina: filtro.pagina, itensPorPagina: filtro.itensPorPagina };
    let uf: string | undefined;
    if (filtro.uf !== undefined) {
      const ente = CodigoIbge.daUf(filtro.uf);
      if (!ente.ok) return { ...vazia, total: 0 };
      uf = ente.value.uf();
    }
    const onde = and(
      uf === undefined ? undefined : eq(obra.uf, uf),
      filtro.situacao === undefined ? undefined : eq(obra.situacao, filtro.situacao),
      filtro.municipio === undefined
        ? undefined
        : arrayContains(obra.municipios, [filtro.municipio]),
      filtro.nome === undefined ? undefined : like(obra.nomeBusca, `%${paraBusca(filtro.nome)}%`),
    );
    const [linhas, [total]] = await Promise.all([
      this.banco.drizzle
        .select({ obra, captura })
        .from(obra)
        .leftJoin(captura, eq(captura.capturaId, obra.capturaId))
        .where(onde)
        .orderBy(...MAIOR_INVESTIMENTO_PRIMEIRO)
        .limit(filtro.itensPorPagina)
        .offset((filtro.pagina - 1) * filtro.itensPorPagina),
      this.banco.drizzle.select({ total: count() }).from(obra).where(onde),
    ]);
    return {
      ...vazia,
      itens: linhas.map((l) => paraResumo(l.obra, l.captura)),
      total: total?.total ?? 0,
    };
  }

  async buscar(obraId: string): Promise<ObraDetalhada | undefined> {
    if (!UUID.test(obraId)) return undefined;
    const [linha] = await this.banco.drizzle
      .select({ obra, captura })
      .from(obra)
      .leftJoin(captura, eq(captura.capturaId, obra.capturaId))
      .where(eq(obra.obraId, obraId.toLowerCase()));
    if (!linha) return undefined;
    const e = linha.obra.estado;
    const codigos = [...new Set(e.emendas.map((x) => x.codigoDaEmenda))];
    const emendas =
      codigos.length === 0
        ? []
        : await this.banco.drizzle
            .select({
              codigo: emenda.codigoNaFonte,
              emendaId: emenda.emendaId,
              pessoaId: emenda.autorPessoaId,
              nome: emenda.autorNome,
            })
            .from(emenda)
            .where(inArray(emenda.codigoNaFonte, codigos));
    const porCodigo = new Map(emendas.map((x) => [x.codigo, x]));
    return {
      ...paraResumo(linha.obra, linha.captura),
      descricao: e.descricao,
      natureza: e.natureza,
      especie: e.especie,
      situacaoNaFonte: e.situacaoNaFonte,
      endereco: e.endereco,
      pontos: e.pontos,
      inicioPrevisto: e.inicioPrevisto,
      fimPrevisto: e.fimPrevisto,
      inicioEfetivo: e.inicioEfetivo,
      fimEfetivo: e.fimEfetivo,
      executores: e.executores,
      interrupcoes: [...e.interrupcoes].reverse(),
      emendas: e.emendas.map((x): EmendaDaObra => {
        const conhecida = porCodigo.get(x.codigoDaEmenda);
        return {
          codigoDaEmenda: x.codigoDaEmenda,
          emendaId: conhecida?.emendaId ?? null,
          autor: conhecida ? { pessoaId: conhecida.pessoaId, nome: conhecida.nome } : null,
          numeroDoEmpenho: x.numeroDoEmpenho,
          acaoOrcamentaria: x.acaoOrcamentaria,
          empenhadoCentavos: x.empenhadoCentavos,
          emitidoEm: x.emitidoEm,
        };
      }),
    };
  }

  async daEmenda(codigoDaEmenda: string): Promise<ObraResumo[]> {
    const linhas = await this.banco.drizzle
      .select({ obra, captura })
      .from(obra)
      .leftJoin(captura, eq(captura.capturaId, obra.capturaId))
      .where(arrayContains(obra.codigosDasEmendas, [codigoDaEmenda]))
      .orderBy(...MAIOR_INVESTIMENTO_PRIMEIRO);
    return linhas.map((l) => paraResumo(l.obra, l.captura));
  }
}

function paraResumo(o: LinhaDeObra, c: LinhaDeCaptura | null): ObraResumo {
  return {
    obraId: o.obraId,
    idNaFonte: o.idNaFonte,
    nome: o.nome,
    situacao: o.situacao as SituacaoDaObra,
    uf: o.uf,
    municipios: o.estado.municipios,
    medicao: o.estado.medicao,
    investimentoPrevistoCentavos: o.investimentoPrevisto.toString(),
    fonte: {
      capturaId: o.capturaId,
      url: c?.url ?? null,
      coletadaEm: c?.coletadaEm.toISOString() ?? null,
    },
  };
}
