import { type DomainError, Result } from '@prometeu/shared-kernel';

import { ESTAGIOS } from '../../domain/estagio.js';
import { CapturaId, IdDoAlvo } from '../../domain/identificadores.js';
import { ReferenciaExterna, TIPOS_DE_ALVO } from '../../domain/referencia-externa.js';
import { ORIGENS_DE_VINCULO } from '../../domain/vinculo.js';
import { alterarPromessa, lerId, lerIds, lerOpcao } from '../entrada.js';
import type { PromessaRepository, Relogio } from '../portas.js';

const ESTAGIOS_COMPROVAVEIS = ESTAGIOS.filter((estagio) => estagio !== 'prometida');

export interface SugerirVinculoInput {
  readonly promessaId: string;
  readonly tipoDoAlvo: string;
  readonly idDoAlvo: string;
  readonly estagioQueComprova: string;
  readonly origem: string;
  readonly evidencias: readonly string[];
}

export interface SugerirVinculoOutput {
  readonly vinculoId: string;
}

/** Chamado pela curadoria ou pelas políticas que reagem a eventos de outros contextos. */
export class SugerirVinculo {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: SugerirVinculoInput): Promise<Result<SugerirVinculoOutput, DomainError>> {
    const tipo = lerOpcao(TIPOS_DE_ALVO, input.tipoDoAlvo, 'tipoDoAlvo');
    if (!tipo.ok) return tipo;
    const idDoAlvo = lerId(IdDoAlvo.de, input.idDoAlvo, 'idDoAlvo');
    if (!idDoAlvo.ok) return idDoAlvo;
    const estagio = lerOpcao(ESTAGIOS_COMPROVAVEIS, input.estagioQueComprova, 'estagioQueComprova');
    if (!estagio.ok) return estagio;
    const origem = lerOpcao(ORIGENS_DE_VINCULO, input.origem, 'origem');
    if (!origem.ok) return origem;
    const evidencias = lerIds(CapturaId.de, input.evidencias, 'evidencias');
    if (!evidencias.ok) return evidencias;

    return alterarPromessa(this.promessas, input.promessaId, (promessa) => {
      const vinculoId = promessa.sugerirVinculo(
        {
          alvo: ReferenciaExterna.criar(tipo.value, idDoAlvo.value),
          estagioQueComprova: estagio.value,
          origem: origem.value,
          evidencias: evidencias.value,
        },
        this.relogio.agora(),
      );
      return vinculoId.ok ? Result.ok({ vinculoId: vinculoId.value.valor }) : vinculoId;
    });
  }
}
