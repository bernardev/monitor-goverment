import type {
  AutoriaDoParlamentar,
  Pagina,
  ProposicaoDetalhada,
  ProposicaoResumo,
  TipoDeProposicao,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, count, desc, eq, sql } from 'drizzle-orm';

import type {
  ConsultaDeProposicoes,
  ConsultaDeVotacoes,
  FiltroDeProposicoes,
  Paginacao,
} from '../application/portas.js';
import { autoria, captura, proposicao } from './esquema.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Movimentada por último primeiro; sem tramitação coletada, no fim. */
const MAIS_RECENTE_PRIMEIRO = [
  sql`${proposicao.ultimaTramitacaoEm} DESC NULLS LAST`,
  desc(proposicao.proposicaoId),
];

type LinhaDeProposicao = typeof proposicao.$inferSelect;
type LinhaDeCaptura = typeof captura.$inferSelect;

export class ConsultaDeProposicoesPostgres implements ConsultaDeProposicoes {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly votacoes: Pick<ConsultaDeVotacoes, 'daProposicao'>,
  ) {}

  async listar(filtro: FiltroDeProposicoes): Promise<Pagina<ProposicaoResumo>> {
    const onde = and(
      filtro.casa === undefined ? undefined : eq(proposicao.casa, filtro.casa),
      filtro.sigla === undefined ? undefined : eq(proposicao.sigla, filtro.sigla),
    );
    const [linhas, [total]] = await Promise.all([
      this.banco.drizzle
        .select({ proposicao, captura })
        .from(proposicao)
        .leftJoin(captura, eq(captura.capturaId, proposicao.capturaId))
        .where(onde)
        .orderBy(...MAIS_RECENTE_PRIMEIRO)
        .limit(filtro.itensPorPagina)
        .offset((filtro.pagina - 1) * filtro.itensPorPagina),
      this.banco.drizzle.select({ total: count() }).from(proposicao).where(onde),
    ]);
    return {
      itens: linhas.map((l) => paraResumo(l.proposicao, l.captura)),
      pagina: filtro.pagina,
      itensPorPagina: filtro.itensPorPagina,
      total: total?.total ?? 0,
    };
  }

  async buscar(proposicaoId: string): Promise<ProposicaoDetalhada | undefined> {
    if (!UUID.test(proposicaoId)) return undefined;
    const [linha] = await this.banco.drizzle
      .select({ proposicao, captura })
      .from(proposicao)
      .leftJoin(captura, eq(captura.capturaId, proposicao.capturaId))
      .where(eq(proposicao.proposicaoId, proposicaoId.toLowerCase()));
    if (!linha) return undefined;
    const p = linha.proposicao;
    return {
      ...paraResumo(p, linha.captura),
      autores: p.autores.map((a) => ({
        pessoaId: a.pessoaId,
        nome: a.nomeNaFonte,
        tipoNaFonte: a.tipoNaFonte,
        proponente: a.proponente,
      })),
      tramitacoes: [...p.tramitacoes].reverse(),
      urlDoTexto: p.urlDoTexto,
      votacoes: await this.votacoes.daProposicao(
        p.casa as ProposicaoResumo['casa'],
        p.codigoNaFonte,
      ),
    };
  }

  async doParlamentar(
    pessoaId: string,
    paginacao: Paginacao,
  ): Promise<Pagina<AutoriaDoParlamentar>> {
    const vazia = { itens: [], pagina: paginacao.pagina, itensPorPagina: paginacao.itensPorPagina };
    if (!UUID.test(pessoaId)) return { ...vazia, total: 0 };
    const onde = eq(autoria.pessoaId, pessoaId.toLowerCase());
    const [linhas, [total]] = await Promise.all([
      this.banco.drizzle
        .select({ proposicao, captura, proponente: autoria.proponente })
        .from(autoria)
        .innerJoin(proposicao, eq(proposicao.proposicaoId, autoria.proposicaoId))
        .leftJoin(captura, eq(captura.capturaId, proposicao.capturaId))
        .where(onde)
        .orderBy(...MAIS_RECENTE_PRIMEIRO)
        .limit(paginacao.itensPorPagina)
        .offset((paginacao.pagina - 1) * paginacao.itensPorPagina),
      this.banco.drizzle.select({ total: count() }).from(autoria).where(onde),
    ]);
    return {
      ...vazia,
      itens: linhas.map((l) => ({
        proposicao: paraResumo(l.proposicao, l.captura),
        proponente: l.proponente,
      })),
      total: total?.total ?? 0,
    };
  }
}

function paraResumo(p: LinhaDeProposicao, c: LinhaDeCaptura | null): ProposicaoResumo {
  return {
    proposicaoId: p.proposicaoId,
    casa: p.casa as ProposicaoResumo['casa'],
    codigoNaFonte: p.codigoNaFonte,
    sigla: p.sigla as TipoDeProposicao,
    numero: p.numero,
    ano: p.ano,
    ementa: p.ementa,
    apresentadaEm: p.apresentadaEm?.toISOString() ?? null,
    situacao: p.situacao,
    ultimaTramitacaoEm: p.ultimaTramitacaoEm?.toISOString() ?? null,
    normaGerada: p.normaGerada,
    fonte: {
      capturaId: p.capturaId,
      url: c?.url ?? null,
      coletadaEm: c?.coletadaEm.toISOString() ?? null,
    },
  };
}
