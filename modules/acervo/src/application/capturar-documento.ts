import { createHash } from 'node:crypto';

import { type DomainError, Result } from '@prometeu/shared-kernel';

import { Captura } from '../domain/captura.js';
import { HashSha256 } from '../domain/hash-sha256.js';
import type { CapturaRepository, Relogio } from './portas.js';

export interface DocumentoBaixado {
  /** Endereço final, depois de seguir redirecionamentos. */
  readonly url: string;
  readonly conteudo: Uint8Array;
  readonly tipoDeConteudo: string;
}

/** Busca um documento público na internet. Recusa endereços internos e conteúdo grande demais. */
export interface BaixadorDeDocumentos {
  baixar(url: string): Promise<Result<DocumentoBaixado, DomainError>>;
}

/** Onde o conteúdo das capturas fica guardado (armazenamento de objetos, ADR-0006). */
export interface ArmazemDeCapturas {
  guardar(caminho: string, conteudo: Uint8Array, tipoDeConteudo: string): Promise<void>;
}

export interface CapturarDocumentoInput {
  readonly url: string;
}

export interface CapturarDocumentoOutput {
  readonly capturaId: string;
  readonly sha256: string;
  readonly nova: boolean;
}

const FONTE = 'curadoria';

/**
 * A curadoria guarda a prova antes de registrar qualquer fato (ADR-0009): baixa o documento, guarda o
 * conteúdo endereçado pelo hash e registra a captura. O mesmo conteúdo devolve a mesma captura.
 */
export class CapturarDocumento {
  constructor(
    private readonly capturas: CapturaRepository,
    private readonly baixador: BaixadorDeDocumentos,
    private readonly armazem: ArmazemDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    input: CapturarDocumentoInput,
  ): Promise<Result<CapturarDocumentoOutput, DomainError>> {
    const baixado = await this.baixador.baixar(input.url);
    if (!baixado.ok) return baixado;
    const documento = baixado.value;
    const agora = this.relogio.agora();

    const sha256 = HashSha256.de(createHash('sha256').update(documento.conteudo).digest('hex'));
    if (!sha256.ok) return sha256;
    const existente = await this.capturas.buscarPorHash(sha256.value);
    if (existente) {
      return Result.ok({ capturaId: existente.id.valor, sha256: sha256.value.valor, nova: false });
    }

    const caminho = caminhoDaCaptura(agora, sha256.value.valor);
    const captura = Captura.registrar(
      {
        fonte: FONTE,
        url: documento.url,
        coletadaEm: agora,
        sha256: sha256.value,
        caminho,
        tipoDeConteudo: documento.tipoDeConteudo,
      },
      agora,
    );
    if (!captura.ok) return captura;

    await this.armazem.guardar(caminho, documento.conteudo, documento.tipoDeConteudo);
    await this.capturas.salvar(captura.value);
    return Result.ok({ capturaId: captura.value.id.valor, sha256: sha256.value.valor, nova: true });
  }
}

/** `capturas/curadoria/aaaa/mm/dd/<sha256>`, como o bronze da plataforma de dados. */
function caminhoDaCaptura(agora: Date, sha256: string): string {
  const [ano, mes, dia] = agora.toISOString().slice(0, 10).split('-');
  return `capturas/${FONTE}/${ano}/${mes}/${dia}/${sha256}`;
}
