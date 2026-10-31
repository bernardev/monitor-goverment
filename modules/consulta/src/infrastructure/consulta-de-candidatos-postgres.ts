import type { CandidatoAVinculo } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { arrayOverlaps, eq } from 'drizzle-orm';

import type { CandidatoDoAutor, ConsultaDeCandidatos } from '../application/portas.js';
import { autoria, emenda, obra, proposicao } from './esquema.js';
import { relevancia, type Termo, termos } from './relevancia.js';

/** Quantos candidatos de cada tipo: a lista é para a curadoria ler, não para exportar. */
const POR_TIPO = 15;

type Tipo = CandidatoAVinculo['tipoDoAlvo'];

interface Fato {
  readonly tipoDoAlvo: Tipo;
  readonly idDoAlvo: string;
  readonly titulo: string;
  readonly detalhe: string;
  readonly estagios: readonly string[];
  readonly capturaId: string;
  /** Para desempatar: o mais recente primeiro. */
  readonly quando: string;
}

/**
 * Os fatos da pessoa que podem comprovar uma promessa dela: proposições de que é autora, emendas que
 * indicou e obras que essas emendas pagam. Ordenados pela relevância para o texto da promessa; é a
 * curadoria quem decide o que vira vínculo (ADR-0010).
 */
export class ConsultaDeCandidatosPostgres implements ConsultaDeCandidatos {
  constructor(private readonly banco: BancoDoContexto) {}

  async doAutor(pessoaId: string, texto: string): Promise<CandidatoDoAutor[]> {
    const [proposicoes, emendas] = await Promise.all([
      this.banco.drizzle
        .select({ proposicao })
        .from(autoria)
        .innerJoin(proposicao, eq(proposicao.proposicaoId, autoria.proposicaoId))
        .where(eq(autoria.pessoaId, pessoaId)),
      this.banco.drizzle.select().from(emenda).where(eq(emenda.autorPessoaId, pessoaId)),
    ]);
    const codigos = emendas.map((e) => e.codigoNaFonte);
    const obras =
      codigos.length === 0
        ? []
        : await this.banco.drizzle
            .select()
            .from(obra)
            .where(arrayOverlaps(obra.codigosDasEmendas, codigos));

    const fatos: Fato[] = [
      ...proposicoes.map(({ proposicao: p }) => ({
        tipoDoAlvo: 'proposicao' as const,
        idDoAlvo: p.proposicaoId,
        titulo: `${p.sigla} ${String(p.numero)}/${String(p.ano)}`,
        detalhe: p.ementa ?? '',
        estagios: ['ato'],
        capturaId: p.capturaId,
        quando: p.apresentadaEm?.toISOString() ?? String(p.ano),
      })),
      ...emendas.map((e) => ({
        tipoDoAlvo: 'emenda' as const,
        idDoAlvo: e.emendaId,
        titulo: `Emenda ${e.numero}/${String(e.ano)}`,
        detalhe: [
          ...new Set(e.destinacoes.flatMap((d) => [d.acao.nome, d.programa.nome, d.localidade])),
        ].join(' · '),
        // Já pagou alguma coisa: comprova execução; só empenhada, orçamento.
        estagios:
          e.pago + e.restosPagos > 0n ? ['execucao', 'orcamento'] : ['orcamento', 'execucao'],
        capturaId: e.capturaId,
        quando: String(e.ano),
      })),
      ...obras.map((o) => ({
        tipoDoAlvo: 'obra' as const,
        idDoAlvo: o.obraId,
        titulo: o.nome,
        detalhe: [o.estado.especie, o.estado.municipios.map((m) => m.nome).join(', '), o.uf]
          .filter(Boolean)
          .join(' · '),
        estagios: o.situacao === 'concluida' ? ['entrega', 'execucao'] : ['execucao', 'entrega'],
        capturaId: o.capturaId,
        quando: o.estado.inicioPrevisto ?? '',
      })),
    ];

    const daPromessa = termos(texto);
    const avaliados = fatos.map((f) => ({ ...f, ...relevancia(daPromessa, termosDo(f)) }));
    return (['proposicao', 'emenda', 'obra'] as const)
      .flatMap((tipo) =>
        avaliados
          .filter((f) => f.tipoDoAlvo === tipo)
          .sort(maisRelevantePrimeiro)
          .slice(0, POR_TIPO),
      )
      .sort(maisRelevantePrimeiro)
      .map((f) => ({
        tipoDoAlvo: f.tipoDoAlvo,
        idDoAlvo: f.idDoAlvo,
        titulo: f.titulo,
        detalhe: f.detalhe,
        estagios: f.estagios,
        relevancia: f.relevancia,
        termosEmComum: f.termosEmComum,
        capturaId: f.capturaId,
      }));
  }
}

function termosDo(f: Fato): Termo[] {
  return termos(`${f.titulo} ${f.detalhe}`);
}

function maisRelevantePrimeiro(
  a: { relevancia: number; quando: string },
  b: { relevancia: number; quando: string },
): number {
  if (a.relevancia !== b.relevancia) return b.relevancia - a.relevancia;
  return a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0;
}
