import { DomainError, Result } from '@prometeu/shared-kernel';

import { CapturaId, CuradorId } from '../../domain/identificadores.js';
import type { Promessa } from '../../domain/promessa.js';
import type { FundamentoDeNaoCumprimento } from '../../domain/proposta-de-veredito.js';
import { VEREDITOS } from '../../domain/veredito.js';
import { alterarPromessa, lerId, lerIds, lerOpcao } from '../entrada.js';
import type { ConsultaDeMandatos, PromessaRepository, Relogio } from '../portas.js';

/**
 * Para `mandato_encerrado`, quem chama não informa a data: ela vem de Agentes Públicos, para que o
 * fundamento não dependa da palavra de quem propõe.
 */
export type FundamentoInput =
  | { readonly tipo: 'mandato_encerrado' }
  | { readonly tipo: 'ato_em_sentido_contrario'; readonly evidenciaId: string };

export interface ProporVereditoInput {
  readonly promessaId: string;
  readonly veredito: string;
  readonly justificativa: string;
  readonly evidencias: readonly string[];
  readonly fundamento?: FundamentoInput | undefined;
  readonly errata?: boolean | undefined;
  readonly propostoPor: string;
}

export class ProporVeredito {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly mandatos: ConsultaDeMandatos,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: ProporVereditoInput): Promise<Result<void, DomainError>> {
    const veredito = lerOpcao(VEREDITOS, input.veredito, 'veredito');
    if (!veredito.ok) return veredito;
    const evidencias = lerIds(CapturaId.de, input.evidencias, 'evidencias');
    if (!evidencias.ok) return evidencias;
    const propostoPor = lerId(CuradorId.de, input.propostoPor, 'propostoPor');
    if (!propostoPor.ok) return propostoPor;

    return alterarPromessa(this.promessas, input.promessaId, async (promessa) => {
      const fundamento = await this.resolverFundamento(promessa, input.fundamento);
      if (!fundamento.ok) return fundamento;

      return promessa.proporVeredito({
        veredito: veredito.value,
        justificativa: input.justificativa,
        evidencias: evidencias.value,
        fundamento: fundamento.value,
        errata: input.errata,
        propostoPor: propostoPor.value,
        propostoEm: this.relogio.agora(),
      });
    });
  }

  private async resolverFundamento(
    promessa: Promessa,
    fundamento: FundamentoInput | undefined,
  ): Promise<Result<FundamentoDeNaoCumprimento | undefined, DomainError>> {
    if (!fundamento) return Result.ok(undefined);

    if (fundamento.tipo === 'ato_em_sentido_contrario') {
      const evidencia = lerId(CapturaId.de, fundamento.evidenciaId, 'fundamento.evidenciaId');
      return evidencia.ok
        ? Result.ok({ tipo: fundamento.tipo, evidencia: evidencia.value })
        : evidencia;
    }

    const { mandato } = promessa.autor;
    if (!mandato) {
      return Result.fail(
        new DomainError(
          'veredito.promessa_sem_mandato',
          'A promessa não está ligada a um mandato; não há fim de mandato para fundamentar.',
        ),
      );
    }
    const encerradoEm = await this.mandatos.fimDoMandato(mandato);
    if (!encerradoEm) {
      return Result.fail(
        new DomainError(
          'veredito.mandato_em_curso',
          'O mandato ainda não terminou; a promessa ainda pode ser cumprida.',
        ),
      );
    }
    return Result.ok({ tipo: 'mandato_encerrado', encerradoEm });
  }
}
