import { AsyncLocalStorage } from 'node:async_hooks';

import { gerarUuidV7 } from '@prometeu/shared-kernel';

const correlacao = new AsyncLocalStorage<string>();

/**
 * Executa `fn` com um `idDeCorrelacao` (ADR-0007): a requisição HTTP, o evento consumido ou o lote que
 * originou o trabalho. Todo evento gravado na outbox dentro de `fn` herda esse id.
 */
export function comCorrelacao<T>(idDeCorrelacao: string, fn: () => Promise<T>): Promise<T> {
  return correlacao.run(idDeCorrelacao, fn);
}

/** Id da cadeia em curso; fora de qualquer cadeia, começa uma nova. */
export function idDeCorrelacaoAtual(): string {
  return correlacao.getStore() ?? gerarUuidV7();
}
