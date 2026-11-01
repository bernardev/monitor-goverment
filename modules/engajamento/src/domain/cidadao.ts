import { AggregateRoot, DomainError, Identificador, Result } from '@prometeu/shared-kernel';

import type { Alvo } from './alvo.js';

/**
 * A pessoa, pelo `sub` do token do provedor de identidade (ADR-0014). O contexto não guarda nome,
 * e-mail nem nada além do que ela acompanha.
 */
export class CidadaoId extends Identificador {
  declare private readonly marca: 'CidadaoId';

  static de(valor: string): Result<CidadaoId, DomainError> {
    const validado = CidadaoId.validar(valor);
    return validado.ok ? Result.ok(new CidadaoId(validado.value)) : validado;
  }
}

/** Acima disto já não é acompanhar, é colecionar; e cada alerta da etapa 6.3 custa um envio. */
export const LIMITE_DE_ACOMPANHAMENTOS = 200;

export interface Acompanhamento {
  readonly alvo: Alvo;
  readonly desde: Date;
}

/** O cidadão e o que ele acompanha. Sem nenhum acompanhamento, não há nada guardado sobre ele. */
export class Cidadao extends AggregateRoot<CidadaoId> {
  /** O que mudou desde que foi lido; o repositório grava só isso. */
  private readonly incluidos = new Map<string, Acompanhamento>();
  private readonly retirados = new Map<string, Alvo>();

  private constructor(
    id: CidadaoId,
    private readonly itens: Map<string, Acompanhamento>,
  ) {
    super(id);
  }

  static reconstituir(id: CidadaoId, acompanhamentos: readonly Acompanhamento[]): Cidadao {
    return new Cidadao(id, new Map(acompanhamentos.map((a) => [a.alvo.chave, a])));
  }

  /** Do mais recente para o mais antigo. */
  get acompanhamentos(): readonly Acompanhamento[] {
    return [...this.itens.values()].sort((a, b) => b.desde.getTime() - a.desde.getTime());
  }

  acompanha(alvo: Alvo): boolean {
    return this.itens.has(alvo.chave);
  }

  /** `false` quando já acompanhava: acompanhar de novo não muda nada nem a data. */
  acompanhar(alvo: Alvo, agora: Date): Result<boolean, DomainError> {
    if (this.acompanha(alvo)) return Result.ok(false);
    if (this.itens.size >= LIMITE_DE_ACOMPANHAMENTOS) {
      return Result.fail(
        new DomainError(
          'acompanhamento.limite',
          `Dá para acompanhar até ${String(LIMITE_DE_ACOMPANHAMENTOS)} políticos e cidades.`,
        ),
      );
    }
    const novo = { alvo, desde: agora };
    this.itens.set(alvo.chave, novo);
    this.incluidos.set(alvo.chave, novo);
    this.retirados.delete(alvo.chave);
    return Result.ok(true);
  }

  /** `false` quando não acompanhava. */
  deixarDeAcompanhar(alvo: Alvo): boolean {
    if (!this.itens.delete(alvo.chave)) return false;
    // Incluído e retirado antes de gravar: não chega a existir no banco.
    if (!this.incluidos.delete(alvo.chave)) this.retirados.set(alvo.chave, alvo);
    return true;
  }

  /**
   * O que gravar: só as mudanças, para que duas abas mexendo ao mesmo tempo não desfaçam uma a
   * outra. Esvazia a lista, como `pullDomainEvents`.
   */
  pullAlteracoes(): { incluidos: Acompanhamento[]; retirados: Alvo[] } {
    const alteracoes = {
      incluidos: [...this.incluidos.values()],
      retirados: [...this.retirados.values()],
    };
    this.incluidos.clear();
    this.retirados.clear();
    return alteracoes;
  }
}
