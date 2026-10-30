import { DomainError, Entity, Result } from '@prometeu/shared-kernel';

import type { EstagioComprovavel } from './estagio.js';
import { type CapturaId, type CuradorId, VinculoId } from './identificadores.js';
import type { ReferenciaExterna } from './referencia-externa.js';
import { semRepeticao, textoObrigatorio } from './validacao.js';

export const ORIGENS_DE_VINCULO = ['curador', 'sugestao_ia'] as const;
export type OrigemDoVinculo = (typeof ORIGENS_DE_VINCULO)[number];

export type SituacaoDoVinculo = 'sugerido' | 'confirmado' | 'rejeitado';

export interface NovoVinculo {
  readonly alvo: ReferenciaExterna;
  readonly estagioQueComprova: EstagioComprovavel;
  readonly origem: OrigemDoVinculo;
  readonly evidencias: readonly CapturaId[];
}

interface Decisao {
  readonly por: CuradorId;
  readonly em: Date;
  readonly motivo: string | undefined;
}

interface PropsDoVinculo extends NovoVinculo {
  readonly situacao: SituacaoDoVinculo;
  readonly sugeridoEm: Date;
  readonly decisao: Decisao | undefined;
}

/**
 * Ligação entre a promessa e um fato de outro contexto. Nasce `sugerido` (por IA ou curador) e só conta
 * para o estágio depois que uma pessoa confirma (invariante 2).
 *
 * Imutável: cada decisão devolve um novo vínculo, e só o agregado `Promessa` troca o antigo pelo novo.
 */
export class Vinculo extends Entity<VinculoId> {
  private constructor(
    id: VinculoId,
    private readonly props: PropsDoVinculo,
  ) {
    super(id);
  }

  static sugerir(novo: NovoVinculo, agora: Date): Result<Vinculo, DomainError> {
    const estagio = novo.alvo.podeComprovar(novo.estagioQueComprova);
    if (!estagio.ok) return estagio;

    const evidencias = semRepeticao(novo.evidencias);
    if (evidencias.length === 0) {
      return Result.fail(
        new DomainError(
          'vinculo.sem_evidencia',
          'O vínculo precisa de ao menos uma captura que comprove o fato.',
        ),
      );
    }

    return Result.ok(
      new Vinculo(VinculoId.gerar(), {
        ...novo,
        evidencias,
        situacao: 'sugerido',
        sugeridoEm: new Date(agora),
        decisao: undefined,
      }),
    );
  }

  get alvo(): ReferenciaExterna {
    return this.props.alvo;
  }

  get estagioQueComprova(): EstagioComprovavel {
    return this.props.estagioQueComprova;
  }

  get origem(): OrigemDoVinculo {
    return this.props.origem;
  }

  get situacao(): SituacaoDoVinculo {
    return this.props.situacao;
  }

  get evidencias(): readonly CapturaId[] {
    return this.props.evidencias;
  }

  get decididoPor(): CuradorId | undefined {
    return this.props.decisao?.por;
  }

  get motivoDaRejeicao(): string | undefined {
    return this.props.decisao?.motivo;
  }

  get contaParaOEstagio(): boolean {
    return this.props.situacao === 'confirmado';
  }

  /** Dois vínculos ativos para o mesmo fato seriam a mesma prova contada duas vezes. */
  ocupaOAlvo(alvo: ReferenciaExterna): boolean {
    return this.props.situacao !== 'rejeitado' && this.props.alvo.equals(alvo);
  }

  confirmar(por: CuradorId, agora: Date): Result<Vinculo, DomainError> {
    if (this.props.situacao !== 'sugerido') {
      return Result.fail(
        new DomainError(
          'vinculo.nao_esta_sugerido',
          `Só um vínculo sugerido pode ser confirmado; este está ${this.props.situacao}.`,
        ),
      );
    }
    return Result.ok(this.decidir('confirmado', { por, em: new Date(agora), motivo: undefined }));
  }

  /**
   * Rejeita uma sugestão ou desfaz uma confirmação (ex.: o PL vinculado foi arquivado). O motivo é
   * obrigatório porque desfazer uma confirmação muda o estágio que o público vê.
   */
  rejeitar(por: CuradorId, motivo: string, agora: Date): Result<Vinculo, DomainError> {
    if (this.props.situacao === 'rejeitado') {
      return Result.fail(new DomainError('vinculo.ja_rejeitado', 'Este vínculo já foi rejeitado.'));
    }
    const texto = textoObrigatorio(
      motivo,
      'vinculo.rejeicao_sem_motivo',
      'Rejeitar um vínculo exige um motivo.',
    );
    if (!texto.ok) return texto;
    return Result.ok(this.decidir('rejeitado', { por, em: new Date(agora), motivo: texto.value }));
  }

  private decidir(situacao: SituacaoDoVinculo, decisao: Decisao): Vinculo {
    return new Vinculo(this.id, { ...this.props, situacao, decisao });
  }
}
