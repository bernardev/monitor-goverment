import type {
  CategoriaDoMotivo,
  DiaDeFrequencia,
  FonteDoDado,
  OpcaoDeVoto,
  Pagina,
  ParticipacaoEmVotacao,
  VotacaoNominalDetalhada,
  VotacaoNominalResumo,
  VotosDoParlamentar,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, asc, count, desc, eq, gte, isNotNull, lte, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { ConsultaDeVotacoes, FiltroDeVotacoes, PeriodoEmDias } from '../application/portas.js';
import { captura, frequencia, parlamentar, votacao, voto } from './esquema.js';

const OPCOES: readonly OpcaoDeVoto[] = [
  'sim',
  'nao',
  'abstencao',
  'obstrucao',
  'presidente_da_sessao',
  'secreto',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const capturaDosVotos = alias(captura, 'captura_dos_votos');

type LinhaDeVotacao = typeof votacao.$inferSelect;
type LinhaDeCaptura = typeof captura.$inferSelect;

export class ConsultaDeVotacoesPostgres implements ConsultaDeVotacoes {
  constructor(private readonly banco: BancoDoContexto) {}

  async listar(filtro: FiltroDeVotacoes): Promise<Pagina<VotacaoNominalResumo>> {
    const onde = and(gte(votacao.dia, filtro.de), lte(votacao.dia, filtro.ate));
    const [linhas, [total]] = await Promise.all([
      this.banco.drizzle
        .select({ votacao, captura })
        .from(votacao)
        .leftJoin(captura, eq(captura.capturaId, votacao.capturaId))
        .where(onde)
        .orderBy(desc(votacao.registradaEm), desc(votacao.votacaoId))
        .limit(filtro.itensPorPagina)
        .offset((filtro.pagina - 1) * filtro.itensPorPagina),
      this.banco.drizzle.select({ total: count() }).from(votacao).where(onde),
    ]);
    return {
      itens: linhas.map((l) => paraResumo(l.votacao, l.captura)),
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

    const votos = await this.banco.drizzle
      .select({ voto, nome: parlamentar.nome })
      .from(voto)
      .leftJoin(parlamentar, eq(parlamentar.pessoaId, voto.pessoaId))
      .where(eq(voto.votacaoId, id))
      .orderBy(asc(parlamentar.nome), asc(voto.pessoaId));
    return {
      ...paraResumo(linha.votacao, linha.captura),
      votos: votos.map(({ voto: v, nome }) => ({
        pessoaId: v.pessoaId,
        nome,
        siglaPartido: v.siglaPartidoNaFonte,
        opcao: v.opcao as OpcaoDeVoto,
        registroNaFonte: v.registroNaFonte,
      })),
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
          // Votou, ou a casa apurou a frequência dele no dia: estava no cargo.
          or(isNotNull(voto.pessoaId), isNotNull(frequencia.registroId)),
        ),
      )
      .orderBy(desc(votacao.registradaEm), desc(votacao.votacaoId));

    const participacoes = linhas.map((l): ParticipacaoEmVotacao => ({
      votacao: paraResumo(l.votacao, l.captura),
      voto: l.voto
        ? { opcao: l.voto.opcao as OpcaoDeVoto, registroNaFonte: l.voto.registroNaFonte }
        : null,
      frequenciaNoDia: l.frequencia
        ? {
            situacao: l.frequencia.situacao as DiaDeFrequencia['situacao'],
            motivo:
              l.frequencia.motivoCategoria === null
                ? null
                : {
                    categoria: l.frequencia.motivoCategoria as CategoriaDoMotivo,
                    descricaoNaFonte: l.frequencia.motivoDescricao ?? '',
                  },
            registroNaFonte: l.frequencia.registroNaFonte,
          }
        : null,
    }));
    return { ...vazio, resumo: resumir(participacoes), participacoes };
  }
}

function paraResumo(v: LinhaDeVotacao, c: LinhaDeCaptura | null): VotacaoNominalResumo {
  return {
    votacaoId: v.votacaoId,
    casa: v.casa as VotacaoNominalResumo['casa'],
    codigoNaFonte: v.codigoNaFonte,
    dia: v.dia,
    registradaEm: v.registradaEm.toISOString(),
    descricao: v.descricao,
    resultado: v.resultado as VotacaoNominalResumo['resultado'],
    secreta: v.secreta,
    proposicoes: v.proposicoes,
    placar: Object.fromEntries(OPCOES.map((o) => [o, v.placar[o] ?? 0])) as Record<
      OpcaoDeVoto,
      number
    >,
    fonte: fonte(v.capturaId, c),
  };
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
