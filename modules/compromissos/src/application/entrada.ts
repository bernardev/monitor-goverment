import { DomainError, Result } from '@prometeu/shared-kernel';

import { TIPOS_DE_FONTE } from '../domain/classificacao.js';
import type { NovaFonte } from '../domain/fonte-da-promessa.js';
import { CapturaId, PromessaId } from '../domain/identificadores.js';
import type { Promessa } from '../domain/promessa.js';
import { type Localizacao, Trecho } from '../domain/trecho.js';
import { ehUmDe } from '../domain/validacao.js';
import type { PromessaRepository } from './portas.js';

// A entrada dos casos de uso chega em primitivos (texto, número, data) já com o formato conferido pela
// camada de interface. Aqui ela vira objetos do domínio; o que não couber volta como DomainError.

type Fabrica<T> = (valor: string) => Result<T, DomainError>;

/** Converte um texto em identificador, anotando qual campo da entrada estava errado. */
export function lerId<T>(
  fabrica: Fabrica<T>,
  valor: string,
  campo: string,
): Result<T, DomainError> {
  const id = fabrica(valor);
  if (id.ok) return id;
  return Result.fail(
    new DomainError(id.error.code, id.error.message, { ...id.error.details, campo }),
  );
}

export function lerIdOpcional<T>(
  fabrica: Fabrica<T>,
  valor: string | undefined,
  campo: string,
): Result<T | undefined, DomainError> {
  return valor === undefined ? Result.ok(undefined) : lerId(fabrica, valor, campo);
}

export function lerIds<T>(
  fabrica: Fabrica<T>,
  valores: readonly string[],
  campo: string,
): Result<T[], DomainError> {
  return Result.all(valores.map((valor) => lerId(fabrica, valor, campo)));
}

export function lerOpcao<T extends string>(
  opcoes: readonly T[],
  valor: string,
  campo: string,
): Result<T, DomainError> {
  if (ehUmDe(opcoes, valor)) return Result.ok(valor);
  return Result.fail(
    new DomainError('entrada.opcao_invalida', `Valor "${valor}" não é aceito em ${campo}.`, {
      campo,
      opcoes,
    }),
  );
}

export interface FonteInput {
  readonly tipo: string;
  readonly capturaId: string;
  readonly citacaoLiteral: string;
  readonly localizacao: Localizacao;
  readonly dataDaDeclaracao: Date;
}

export function lerFonte(input: FonteInput): Result<NovaFonte, DomainError> {
  const tipo = lerOpcao(TIPOS_DE_FONTE, input.tipo, 'fonte.tipo');
  if (!tipo.ok) return tipo;
  const captura = lerId(CapturaId.de, input.capturaId, 'fonte.capturaId');
  if (!captura.ok) return captura;
  const trecho = Trecho.criar(input.citacaoLiteral, input.localizacao);
  if (!trecho.ok) return trecho;

  return Result.ok({
    tipo: tipo.value,
    captura: captura.value,
    trecho: trecho.value,
    dataDaDeclaracao: input.dataDaDeclaracao,
  });
}

/**
 * Carrega a promessa, aplica a alteração e salva só se ela deu certo. Os métodos do agregado conferem
 * tudo antes de mudar o estado, então uma falha nunca deixa a promessa pela metade.
 */
export async function alterarPromessa<T>(
  promessas: PromessaRepository,
  promessaId: string,
  alterar: (promessa: Promessa) => Result<T, DomainError> | Promise<Result<T, DomainError>>,
): Promise<Result<T, DomainError>> {
  const id = lerId(PromessaId.de, promessaId, 'promessaId');
  if (!id.ok) return id;

  const promessa = await promessas.buscarPorId(id.value);
  if (!promessa) {
    return Result.fail(
      new DomainError('promessa.nao_encontrada', 'Promessa não encontrada.', {
        promessaId: id.value.valor,
      }),
    );
  }

  const resultado = await alterar(promessa);
  if (resultado.ok) await promessas.salvar(promessa);
  return resultado;
}
