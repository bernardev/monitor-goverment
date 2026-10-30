import type {
  EmendaDetalhada,
  EmendaResumo,
  EmendasDoParlamentar,
  ExecucaoDaEmenda,
  Pagina,
  TipoDeEmenda,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { CodigoIbge } from '@prometeu/shared-kernel';
import { and, arrayContains, count, desc, eq, sum } from 'drizzle-orm';

import type { ConsultaDeEmendas, FiltroDeEmendas, Paginacao } from '../application/portas.js';
import { captura, emenda, type ExecucaoProjetada } from './esquema.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Orçamento mais recente primeiro; no mesmo ano, a de maior empenho. */
const MAIS_RECENTE_PRIMEIRO = [desc(emenda.ano), desc(emenda.empenhado), desc(emenda.emendaId)];

type LinhaDeEmenda = typeof emenda.$inferSelect;
type LinhaDeCaptura = typeof captura.$inferSelect;

export class ConsultaDeEmendasPostgres implements ConsultaDeEmendas {
  constructor(private readonly banco: BancoDoContexto) {}

  async listar(filtro: FiltroDeEmendas): Promise<Pagina<EmendaResumo>> {
    let uf: string | undefined;
    if (filtro.uf !== undefined) {
      const ente = CodigoIbge.daUf(filtro.uf);
      if (!ente.ok) return { ...paginaVazia(filtro), total: 0 };
      uf = ente.value.uf();
    }
    const onde = and(
      filtro.ano === undefined ? undefined : eq(emenda.ano, filtro.ano),
      filtro.tipo === undefined ? undefined : eq(emenda.tipo, filtro.tipo),
      uf === undefined ? undefined : arrayContains(emenda.ufs, [uf]),
    );
    const [linhas, [total]] = await Promise.all([
      this.banco.drizzle
        .select({ emenda, captura })
        .from(emenda)
        .leftJoin(captura, eq(captura.capturaId, emenda.capturaId))
        .where(onde)
        .orderBy(...MAIS_RECENTE_PRIMEIRO)
        .limit(filtro.itensPorPagina)
        .offset((filtro.pagina - 1) * filtro.itensPorPagina),
      this.banco.drizzle.select({ total: count() }).from(emenda).where(onde),
    ]);
    return {
      ...paginaVazia(filtro),
      itens: linhas.map((l) => paraResumo(l.emenda, l.captura)),
      total: total?.total ?? 0,
    };
  }

  async buscar(emendaId: string): Promise<EmendaDetalhada | undefined> {
    if (!UUID.test(emendaId)) return undefined;
    const [linha] = await this.banco.drizzle
      .select({ emenda, captura })
      .from(emenda)
      .leftJoin(captura, eq(captura.capturaId, emenda.capturaId))
      .where(eq(emenda.emendaId, emendaId.toLowerCase()));
    if (!linha) return undefined;
    return {
      ...paraResumo(linha.emenda, linha.captura),
      destinacoes: linha.emenda.destinacoes.map((d) => ({
        localidade: d.localidade,
        municipioIbge: d.municipioIbge,
        uf: siglaDaUf(d.ufIbge ?? d.municipioIbge),
        funcao: d.funcao,
        subfuncao: d.subfuncao,
        programa: d.programa,
        acao: d.acao,
        planoOrcamentario: d.planoOrcamentario,
        modalidade: d.modalidade,
        execucao: execucaoDe(d),
      })),
    };
  }

  async doParlamentar(pessoaId: string, paginacao: Paginacao): Promise<EmendasDoParlamentar> {
    if (!UUID.test(pessoaId)) return { ...paginaVazia(paginacao), total: 0, soma: SOMA_ZERADA };
    const onde = eq(emenda.autorPessoaId, pessoaId.toLowerCase());
    const [linhas, [agregado]] = await Promise.all([
      this.banco.drizzle
        .select({ emenda, captura })
        .from(emenda)
        .leftJoin(captura, eq(captura.capturaId, emenda.capturaId))
        .where(onde)
        .orderBy(...MAIS_RECENTE_PRIMEIRO)
        .limit(paginacao.itensPorPagina)
        .offset((paginacao.pagina - 1) * paginacao.itensPorPagina),
      this.banco.drizzle
        .select({
          total: count(),
          empenhadoCentavos: sum(emenda.empenhado),
          liquidadoCentavos: sum(emenda.liquidado),
          pagoCentavos: sum(emenda.pago),
          restosInscritosCentavos: sum(emenda.restosInscritos),
          restosCanceladosCentavos: sum(emenda.restosCancelados),
          restosPagosCentavos: sum(emenda.restosPagos),
        })
        .from(emenda)
        .where(onde),
    ]);
    // `sum` de bigint é numeric: o driver devolve texto, e `null` quando não há emenda.
    const somada = (valor: string | null | undefined) => valor ?? '0';
    return {
      ...paginaVazia(paginacao),
      itens: linhas.map((l) => paraResumo(l.emenda, l.captura)),
      total: agregado?.total ?? 0,
      soma: {
        empenhadoCentavos: somada(agregado?.empenhadoCentavos),
        liquidadoCentavos: somada(agregado?.liquidadoCentavos),
        pagoCentavos: somada(agregado?.pagoCentavos),
        restosInscritosCentavos: somada(agregado?.restosInscritosCentavos),
        restosCanceladosCentavos: somada(agregado?.restosCanceladosCentavos),
        restosPagosCentavos: somada(agregado?.restosPagosCentavos),
      },
    };
  }
}

const SOMA_ZERADA: ExecucaoDaEmenda = {
  empenhadoCentavos: '0',
  liquidadoCentavos: '0',
  pagoCentavos: '0',
  restosInscritosCentavos: '0',
  restosCanceladosCentavos: '0',
  restosPagosCentavos: '0',
};

function paginaVazia(paginacao: Paginacao) {
  return { itens: [], pagina: paginacao.pagina, itensPorPagina: paginacao.itensPorPagina };
}

function execucaoDe(e: ExecucaoProjetada): ExecucaoDaEmenda {
  return {
    empenhadoCentavos: e.empenhadoCentavos,
    liquidadoCentavos: e.liquidadoCentavos,
    pagoCentavos: e.pagoCentavos,
    restosInscritosCentavos: e.restosInscritosCentavos,
    restosCanceladosCentavos: e.restosCanceladosCentavos,
    restosPagosCentavos: e.restosPagosCentavos,
  };
}

function siglaDaUf(codigo: string | null): string | null {
  if (codigo === null) return null;
  const ente = CodigoIbge.criar(codigo.slice(0, 2));
  return (ente.ok ? ente.value.uf() : undefined) ?? null;
}

function paraResumo(e: LinhaDeEmenda, c: LinhaDeCaptura | null): EmendaResumo {
  return {
    emendaId: e.emendaId,
    codigoNaFonte: e.codigoNaFonte,
    ano: e.ano,
    tipo: e.tipo as TipoDeEmenda,
    numero: e.numero,
    autor: { pessoaId: e.autorPessoaId, nome: e.autorNome },
    ufs: e.ufs,
    localidades: [...new Set(e.destinacoes.map((d) => d.localidade))],
    modalidades: [
      ...new Set(e.destinacoes.flatMap((d) => (d.modalidade === null ? [] : [d.modalidade]))),
    ].sort(),
    execucao: {
      empenhadoCentavos: e.empenhado.toString(),
      liquidadoCentavos: e.liquidado.toString(),
      pagoCentavos: e.pago.toString(),
      restosInscritosCentavos: e.restosInscritos.toString(),
      restosCanceladosCentavos: e.restosCancelados.toString(),
      restosPagosCentavos: e.restosPagos.toString(),
    },
    fonte: {
      capturaId: e.capturaId,
      url: c?.url ?? null,
      coletadaEm: c?.coletadaEm.toISOString() ?? null,
    },
  };
}
