import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

import type { CapturaId, CuradorId } from './identificadores.js';
import { ehSensivel, type Veredito } from './veredito.js';
import { semRepeticao, textoObrigatorio } from './validacao.js';

/**
 * Por que a promessa não foi cumprida (invariante 4). Sem um destes, "não cumprida" seria opinião sobre
 * algo que ainda pode acontecer.
 */
export type FundamentoDeNaoCumprimento =
  | { readonly tipo: 'mandato_encerrado'; readonly encerradoEm: Date }
  | { readonly tipo: 'ato_em_sentido_contrario'; readonly evidencia: CapturaId };

export interface DadosDaProposta {
  readonly veredito: Veredito;
  readonly justificativa: string;
  readonly evidencias: readonly CapturaId[];
  readonly fundamento?: FundamentoDeNaoCumprimento | undefined;
  /** Errata corrige o veredito vigente por erro de avaliação, fora da máquina de estados. */
  readonly errata?: boolean | undefined;
  readonly propostoPor: CuradorId;
  readonly propostoEm: Date;
}

export interface EstadoDaProposta {
  veredito: Veredito;
  justificativa: string;
  evidencias: readonly CapturaId[];
  fundamento: FundamentoDeNaoCumprimento | undefined;
  errata: boolean;
  propostoPor: CuradorId;
  propostoEm: Date;
}

/**
 * Veredito proposto por um curador e ainda não publicado. As regras que dependem só da proposta ficam
 * aqui; as que dependem da história da promessa (transição, mensurabilidade) ficam no agregado.
 */
export class PropostaDeVeredito extends ValueObject<EstadoDaProposta> {
  private constructor(props: EstadoDaProposta) {
    super(props);
  }

  static criar(dados: DadosDaProposta): Result<PropostaDeVeredito, DomainError> {
    const justificativa = textoObrigatorio(
      dados.justificativa,
      'veredito.sem_justificativa',
      'Todo veredito precisa de justificativa.',
    );
    if (!justificativa.ok) return justificativa;

    const evidencias = semRepeticao(dados.evidencias);
    if (evidencias.length === 0) {
      return Result.fail(
        new DomainError(
          'veredito.sem_evidencia',
          'Todo veredito precisa de ao menos uma captura como evidência.',
        ),
      );
    }

    const fundamento = validarFundamento(dados);
    if (!fundamento.ok) return fundamento;

    return Result.ok(
      new PropostaDeVeredito({
        veredito: dados.veredito,
        justificativa: justificativa.value,
        evidencias,
        fundamento: fundamento.value,
        errata: dados.errata ?? false,
        propostoPor: dados.propostoPor,
        propostoEm: new Date(dados.propostoEm),
      }),
    );
  }

  /** Recria a proposta gravada; as regras já foram conferidas quando ela foi feita. */
  static reconstituir(estado: EstadoDaProposta): PropostaDeVeredito {
    return new PropostaDeVeredito(estado);
  }

  get veredito(): Veredito {
    return this.props.veredito;
  }

  get justificativa(): string {
    return this.props.justificativa;
  }

  get evidencias(): readonly CapturaId[] {
    return this.props.evidencias;
  }

  get fundamento(): FundamentoDeNaoCumprimento | undefined {
    return this.props.fundamento;
  }

  get ehErrata(): boolean {
    return this.props.errata;
  }

  get propostoPor(): CuradorId {
    return this.props.propostoPor;
  }

  get propostoEm(): Date {
    return new Date(this.props.propostoEm);
  }

  /** Vereditos sensíveis e erratas exigem uma segunda pessoa (regra dos quatro olhos). */
  get exigeRevisao(): boolean {
    return this.props.errata || ehSensivel(this.props.veredito);
  }
}

function validarFundamento(
  dados: DadosDaProposta,
): Result<FundamentoDeNaoCumprimento | undefined, DomainError> {
  const { fundamento } = dados;

  if (dados.veredito !== 'nao_cumprida') {
    if (fundamento) {
      return Result.fail(
        new DomainError(
          'veredito.fundamento_inesperado',
          'Fundamento de não cumprimento só se aplica ao veredito nao_cumprida.',
        ),
      );
    }
    return Result.ok(undefined);
  }

  if (!fundamento) {
    return Result.fail(
      new DomainError(
        'veredito.nao_cumprida_sem_fundamento',
        'Não cumprida exige mandato encerrado ou ato em sentido contrário com evidência.',
      ),
    );
  }

  if (fundamento.tipo === 'mandato_encerrado') {
    if (fundamento.encerradoEm > dados.propostoEm) {
      return Result.fail(
        new DomainError(
          'veredito.mandato_em_curso',
          'O mandato ainda não terminou; a promessa ainda pode ser cumprida.',
        ),
      );
    }
    return Result.ok({ tipo: 'mandato_encerrado', encerradoEm: new Date(fundamento.encerradoEm) });
  }

  if (!dados.evidencias.some((evidencia) => evidencia.equals(fundamento.evidencia))) {
    return Result.fail(
      new DomainError(
        'veredito.ato_contrario_fora_das_evidencias',
        'A captura do ato em sentido contrário precisa estar entre as evidências do veredito.',
      ),
    );
  }
  return Result.ok(fundamento);
}
