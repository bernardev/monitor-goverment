import { type DomainError, Result } from '@prometeu/shared-kernel';

import { CapturaId, CuradorId, IdDoAlvo } from '../../domain/identificadores.js';
import { ReferenciaExterna, TIPOS_DE_ALVO } from '../../domain/referencia-externa.js';
import { alterarPromessa, lerId, lerOpcao } from '../entrada.js';
import type { PromessaRepository, Relogio } from '../portas.js';

export interface FatoQueMudou {
  readonly tipoDoAlvo: string;
  readonly idDoAlvo: string;
  /** O que mudou, em uma frase (`A obra foi paralisada em 21/09/2026`). */
  readonly motivo: string;
  /** A captura que prova o estado novo do fato. */
  readonly capturaId: string;
}

export interface SolicitarReavaliacaoOutput {
  /** Promessas que ganharam pedido novo (as que já tinham o mesmo pedido pendente não contam). */
  readonly promessas: readonly string[];
}

/**
 * Política: um fato de outro contexto mudou. Toda promessa com vínculo confirmado com ele ganha um
 * pedido de reavaliação; nada mais muda (ADR-0010: a política sugere, a pessoa decide).
 */
export class SolicitarReavaliacao {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(fato: FatoQueMudou): Promise<Result<SolicitarReavaliacaoOutput, DomainError>> {
    const tipo = lerOpcao(TIPOS_DE_ALVO, fato.tipoDoAlvo, 'tipoDoAlvo');
    if (!tipo.ok) return tipo;
    const id = lerId(IdDoAlvo.de, fato.idDoAlvo, 'idDoAlvo');
    if (!id.ok) return id;
    const captura = lerId(CapturaId.de, fato.capturaId, 'capturaId');
    if (!captura.ok) return captura;
    const alvo = ReferenciaExterna.criar(tipo.value, id.value);

    const novas: string[] = [];
    for (const promessaId of await this.promessas.comVinculoConfirmado(
      tipo.value,
      id.value.valor,
    )) {
      const pedida = await alterarPromessa(this.promessas, promessaId, (promessa) =>
        promessa.solicitarReavaliacao(alvo, fato.motivo, captura.value, this.relogio.agora()),
      );
      if (!pedida.ok) return pedida;
      if (pedida.value) novas.push(promessaId);
    }
    return Result.ok({ promessas: novas });
  }
}

export interface ConcluirReavaliacaoInput {
  readonly promessaId: string;
  readonly concluidaPor: string;
}

/** A curadoria olhou os fatos que mudaram e fez o que cabia (vínculo, veredito). */
export class ConcluirReavaliacao {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: ConcluirReavaliacaoInput): Promise<Result<void, DomainError>> {
    const curador = lerId(CuradorId.de, input.concluidaPor, 'concluidaPor');
    if (!curador.ok) return curador;
    return alterarPromessa(this.promessas, input.promessaId, (promessa) =>
      promessa.concluirReavaliacao(curador.value, this.relogio.agora()),
    );
  }
}
