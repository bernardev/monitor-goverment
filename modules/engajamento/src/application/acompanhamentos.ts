import { type DomainError, Result } from '@prometeu/shared-kernel';

import { Alvo, type TipoDeAlvo } from '../domain/alvo.js';
import { CidadaoId } from '../domain/cidadao.js';
import type { CidadaoRepository, Relogio } from './portas.js';

export interface AlvoInput {
  readonly cidadaoId: string;
  readonly tipo: string;
  readonly id: string;
}

export interface AcompanhamentoOutput {
  readonly tipo: TipoDeAlvo;
  readonly id: string;
  readonly desde: Date;
}

function ler(input: AlvoInput): Result<{ cidadao: CidadaoId; alvo: Alvo }, DomainError> {
  const cidadao = CidadaoId.de(input.cidadaoId);
  if (!cidadao.ok) return cidadao;
  const alvo = Alvo.criar(input.tipo, input.id);
  if (!alvo.ok) return alvo;
  return Result.ok({ cidadao: cidadao.value, alvo: alvo.value });
}

/** Passa a acompanhar um político ou uma cidade. Acompanhar de novo não é erro. */
export class Acompanhar {
  constructor(
    private readonly cidadaos: CidadaoRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(input: AlvoInput): Promise<Result<void, DomainError>> {
    const lido = ler(input);
    if (!lido.ok) return lido;
    const cidadao = await this.cidadaos.buscar(lido.value.cidadao);
    const novo = cidadao.acompanhar(lido.value.alvo, this.relogio.agora());
    if (!novo.ok) return novo;
    if (novo.value) await this.cidadaos.salvar(cidadao);
    return Result.ok(undefined);
  }
}

/** Deixa de acompanhar. Deixar o que não acompanhava não é erro. */
export class DeixarDeAcompanhar {
  constructor(private readonly cidadaos: CidadaoRepository) {}

  async execute(input: AlvoInput): Promise<Result<void, DomainError>> {
    const lido = ler(input);
    if (!lido.ok) return lido;
    const cidadao = await this.cidadaos.buscar(lido.value.cidadao);
    if (cidadao.deixarDeAcompanhar(lido.value.alvo)) await this.cidadaos.salvar(cidadao);
    return Result.ok(undefined);
  }
}

/** O que a pessoa acompanha, do mais recente para o mais antigo. */
export class ListarAcompanhamentos {
  constructor(private readonly cidadaos: CidadaoRepository) {}

  async execute(cidadaoId: string): Promise<Result<AcompanhamentoOutput[], DomainError>> {
    const id = CidadaoId.de(cidadaoId);
    if (!id.ok) return id;
    const cidadao = await this.cidadaos.buscar(id.value);
    return Result.ok(
      cidadao.acompanhamentos.map((a) => ({ tipo: a.alvo.tipo, id: a.alvo.id, desde: a.desde })),
    );
  }
}

/** Apaga tudo o que o contexto guarda sobre a pessoa. A conta no provedor é dela, à parte. */
export class EsquecerCidadao {
  constructor(private readonly cidadaos: CidadaoRepository) {}

  async execute(cidadaoId: string): Promise<Result<void, DomainError>> {
    const id = CidadaoId.de(cidadaoId);
    if (!id.ok) return id;
    await this.cidadaos.apagar(id.value);
    return Result.ok(undefined);
  }
}
