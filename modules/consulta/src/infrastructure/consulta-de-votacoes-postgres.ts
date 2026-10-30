import type {
  CategoriaDoMotivo,
  DiaDeFrequencia,
  FonteDoDado,
  OpcaoDeVoto,
  Pagina,
  ParticipacaoEmVotacao,
  SemVotoNaVotacao,
  SituacaoSemVoto,
  VotacaoNominalDetalhada,
  VotacaoNominalResumo,
  VotosDoParlamentar,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, asc, count, desc, eq, gte, isNotNull, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { ConsultaDeVotacoes, FiltroDeVotacoes, PeriodoEmDias } from '../application/portas.js';
import { captura, frequencia, parlamentar, proposicao, votacao, voto } from './esquema.js';

const OPCOES: readonly OpcaoDeVoto[] = [
  'sim',
  'nao',
  'abstencao',
  'obstrucao',
  'presidente_da_sessao',
  'secreto',
];

const SITUACOES_SEM_VOTO: readonly SituacaoSemVoto[] = [
  'presente_sem_voto',
  'ausente',
  'ausencia_justificada',
  'nao_informada',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const capturaDosVotos = alias(captura, 'captura_dos_votos');

/** Da mais recente para a mais antiga; sem horário (Senado), depois das do mesmo dia com horário. */
const MAIS_RECENTE_PRIMEIRO = [
  desc(votacao.dia),
  sql`${votacao.registradaEm} DESC NULLS LAST`,
  desc(votacao.codigoNaFonte),
];

type LinhaDeVotacao = typeof votacao.$inferSelect;
type LinhaDeCaptura = typeof captura.$inferSelect;
type LinhaDeVoto = typeof voto.$inferSelect;

export class ConsultaDeVotacoesPostgres implements ConsultaDeVotacoes {
  constructor(private readonly banco: BancoDoContexto) {}

  async listar(filtro: FiltroDeVotacoes): Promise<Pagina<VotacaoNominalResumo>> {
    const onde = and(
      gte(votacao.dia, filtro.de),
      lte(votacao.dia, filtro.ate),
      filtro.casa === undefined ? undefined : eq(votacao.casa, filtro.casa),
    );
    const [linhas, [total]] = await Promise.all([
      this.banco.drizzle
        .select({ votacao, captura })
        .from(votacao)
        .leftJoin(captura, eq(captura.capturaId, votacao.capturaId))
        .where(onde)
        .orderBy(...MAIS_RECENTE_PRIMEIRO)
        .limit(filtro.itensPorPagina)
        .offset((filtro.pagina - 1) * filtro.itensPorPagina),
      this.banco.drizzle.select({ total: count() }).from(votacao).where(onde),
    ]);
    return {
      itens: await this.resumos(linhas),
      pagina: filtro.pagina,
      itensPorPagina: filtro.itensPorPagina,
      total: total?.total ?? 0,
    };
  }

  async buscar(votacaoId: string): Promise<VotacaoNominalDetalhada | undefined> {
    if (!UUID.test(votacaoId)) return undefined;
    const id = votacaoId.toLowerCase();
    const [linha] = await this.banco.drizzle
      .select({ votacao, captura, capturaDosVotos })
      .from(votacao)
      .leftJoin(captura, eq(captura.capturaId, votacao.capturaId))
      .leftJoin(capturaDosVotos, eq(capturaDosVotos.capturaId, votacao.capturaDosVotosId))
      .where(eq(votacao.votacaoId, id));
    if (!linha) return undefined;

    const registros = await this.banco.drizzle
      .select({ voto, nome: parlamentar.nome })
      .from(voto)
      .leftJoin(parlamentar, eq(parlamentar.pessoaId, voto.pessoaId))
      .where(eq(voto.votacaoId, id))
      .orderBy(asc(parlamentar.nome), asc(voto.pessoaId));
    const votos: VotacaoNominalDetalhada['votos'][number][] = [];
    const semVoto: VotacaoNominalDetalhada['semVoto'][number][] = [];
    for (const { voto: v, nome } of registros) {
      const quem = { pessoaId: v.pessoaId, nome, siglaPartido: v.siglaPartidoNaFonte };
      if (v.opcao !== null) {
        votos.push({ ...quem, opcao: v.opcao as OpcaoDeVoto, registroNaFonte: v.registroNaFonte });
      } else {
        const registro = paraSemVoto(v);
        if (registro) semVoto.push({ ...quem, ...registro });
      }
    }
    const [resumo] = await this.resumos([linha]);
    if (!resumo) return undefined;
    return {
      ...resumo,
      votos,
      semVoto,
      fonteDosVotos: fonte(linha.votacao.capturaDosVotosId, linha.capturaDosVotos),
    };
  }

  async doParlamentar(pessoaId: string, periodo: PeriodoEmDias): Promise<VotosDoParlamentar> {
    const vazio = { pessoaId, de: periodo.de, ate: periodo.ate };
    if (!UUID.test(pessoaId)) return { ...vazio, resumo: resumir([]), participacoes: [] };

    const linhas = await this.banco.drizzle
      .select({ votacao, captura, voto, frequencia })
      .from(votacao)
      .leftJoin(captura, eq(captura.capturaId, votacao.capturaId))
      .leftJoin(voto, and(eq(voto.votacaoId, votacao.votacaoId), eq(voto.pessoaId, pessoaId)))
      .leftJoin(
        frequencia,
        and(
          eq(frequencia.pessoaId, pessoaId),
          eq(frequencia.dia, votacao.dia),
          eq(frequencia.casa, votacao.casa),
        ),
      )
      .where(
        and(
          gte(votacao.dia, periodo.de),
          lte(votacao.dia, periodo.ate),
          // A votação o lista (votou ou não), ou a casa apurou a frequência dele no dia.
          or(isNotNull(voto.pessoaId), isNotNull(frequencia.registroId)),
        ),
      )
      .orderBy(...MAIS_RECENTE_PRIMEIRO);

    const resumos = await this.resumos(linhas);
    const participacoes = linhas.map((l, i): ParticipacaoEmVotacao => ({
      votacao: resumos[i] as VotacaoNominalResumo,
      voto:
        l.voto?.opcao != null
          ? { opcao: l.voto.opcao as OpcaoDeVoto, registroNaFonte: l.voto.registroNaFonte }
          : null,
      semVoto: l.voto ? paraSemVoto(l.voto) : null,
      frequenciaNoDia: l.frequencia
        ? {
            situacao: l.frequencia.situacao as DiaDeFrequencia['situacao'],
            motivo: motivo(l.frequencia.motivoCategoria, l.frequencia.motivoDescricao),
            registroNaFonte: l.frequencia.registroNaFonte,
          }
        : null,
    }));
    return { ...vazio, resumo: resumir(participacoes), participacoes };
  }

  async daProposicao(
    casa: VotacaoNominalResumo['casa'],
    codigoNaFonte: string,
  ): Promise<VotacaoNominalResumo[]> {
    const linhas = await this.banco.drizzle
      .select({ votacao, captura })
      .from(votacao)
      .leftJoin(captura, eq(captura.capturaId, votacao.capturaId))
      .where(
        and(
          eq(votacao.casa, casa),
          sql`${votacao.proposicoes} @> ${JSON.stringify([{ codigoNaFonte }])}::jsonb`,
        ),
      )
      .orderBy(...MAIS_RECENTE_PRIMEIRO);
    return this.resumos(linhas);
  }

  /** Os resumos, com cada proposição afetada ligada à proposição no Prometeu quando já coletada. */
  private async resumos(
    linhas: readonly { votacao: LinhaDeVotacao; captura: LinhaDeCaptura | null }[],
  ): Promise<VotacaoNominalResumo[]> {
    const citadas = linhas.flatMap(({ votacao: v }) =>
      v.proposicoes.map((p) =>
        and(eq(proposicao.casa, v.casa), eq(proposicao.codigoNaFonte, p.codigoNaFonte)),
      ),
    );
    const ligacoes = new Map<string, string>();
    if (citadas.length > 0) {
      const encontradas = await this.banco.drizzle
        .select({
          proposicaoId: proposicao.proposicaoId,
          casa: proposicao.casa,
          codigoNaFonte: proposicao.codigoNaFonte,
        })
        .from(proposicao)
        .where(or(...citadas));
      for (const e of encontradas) ligacoes.set(chave(e.casa, e.codigoNaFonte), e.proposicaoId);
    }
    return linhas.map((l) => paraResumo(l.votacao, l.captura, ligacoes));
  }
}

/** Chave de uma proposição da casa nas ligações com a projeção de proposições. */
const chave = (casa: string, codigoNaFonte: string) => `${casa}|${codigoNaFonte}`;

function paraResumo(
  v: LinhaDeVotacao,
  c: LinhaDeCaptura | null,
  ligacoes: ReadonlyMap<string, string>,
): VotacaoNominalResumo {
  return {
    votacaoId: v.votacaoId,
    casa: v.casa as VotacaoNominalResumo['casa'],
    codigoNaFonte: v.codigoNaFonte,
    dia: v.dia,
    registradaEm: v.registradaEm?.toISOString() ?? null,
    descricao: v.descricao,
    resultado: v.resultado as VotacaoNominalResumo['resultado'],
    secreta: v.secreta,
    proposicoes: v.proposicoes.map((p) => ({
      ...p,
      proposicaoId: ligacoes.get(chave(v.casa, p.codigoNaFonte)) ?? null,
    })),
    placar: contagem(OPCOES, v.placar),
    relacaoCompleta: v.relacaoCompleta,
    contagemSemVoto: contagem(SITUACOES_SEM_VOTO, v.contagemSemVoto),
    fonte: fonte(v.capturaId, c),
  };
}

function contagem<T extends string>(
  chaves: readonly T[],
  valores: Record<string, number>,
): Record<T, number> {
  return Object.fromEntries(chaves.map((c) => [c, valores[c] ?? 0])) as Record<T, number>;
}

function paraSemVoto(v: LinhaDeVoto): SemVotoNaVotacao | null {
  if (v.situacaoSemVoto === null) return null;
  return {
    situacao: v.situacaoSemVoto as SituacaoSemVoto,
    motivo: motivo(v.motivoCategoria, v.motivoDescricao),
    registroNaFonte: v.registroNaFonte ?? '',
  };
}

function motivo(categoria: string | null, descricao: string | null): SemVotoNaVotacao['motivo'] {
  return categoria === null
    ? null
    : { categoria: categoria as CategoriaDoMotivo, descricaoNaFonte: descricao ?? '' };
}

function fonte(capturaId: string, c: LinhaDeCaptura | null): FonteDoDado {
  return { capturaId, url: c?.url ?? null, coletadaEm: c?.coletadaEm.toISOString() ?? null };
}

function resumir(participacoes: readonly ParticipacaoEmVotacao[]): VotosDoParlamentar['resumo'] {
  const porOpcao = new Map<OpcaoDeVoto, number>();
  for (const { voto: v } of participacoes) {
    if (v) porOpcao.set(v.opcao, (porOpcao.get(v.opcao) ?? 0) + 1);
  }
  const comVoto = participacoes.filter((p) => p.voto !== null).length;
  return {
    votacoes: participacoes.length,
    comVoto,
    semVotoRegistrado: participacoes.length - comVoto,
    porOpcao: OPCOES.filter((o) => porOpcao.has(o)).map((opcao) => ({
      opcao,
      votos: porOpcao.get(opcao) ?? 0,
    })),
  };
}
