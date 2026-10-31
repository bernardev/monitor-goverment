import type { DomainError, Result } from '@prometeu/shared-kernel';

import type { Emenda } from '../domain/emenda.js';
import type { CapturaId, PessoaId } from '../domain/identificadores.js';

export interface EmendaRepository {
  buscar(codigoNaFonte: string): Promise<Emenda | undefined>;
  /** Grava a emenda e seus eventos na mesma transação (ADR-0007). */
  salvar(emenda: Emenda): Promise<void>;
}

/**
 * Quem é o autor da emenda. A fonte só dá o nome; Agentes Públicos, o único contexto que decide quem
 * é quem, compara com os parlamentares em exercício quando a emenda foi apresentada.
 */
export interface AutoresDasEmendas {
  /**
   * O parlamentar de nome único entre os que exerciam mandato quando as emendas ao orçamento foram
   * apresentadas, no fim do ano anterior.
   */
  parlamentarPeloNome(nome: string, anoDoOrcamento: number): Promise<PessoaId | undefined>;
}

/** De onde veio um dado: a resposta bruta guardada no bronze (ADR-0016). */
export interface OrigemDoDado {
  readonly fonte: string;
  readonly url: string;
  readonly coletadaEm: Date;
  readonly sha256: string;
  readonly caminho: string;
  readonly tipoDeConteudo: string;
}

/** Registro de capturas no contexto Acervo; idempotente pelo hash (ADR-0016). */
export interface RegistroDeCapturas {
  registrar(origem: OrigemDoDado): Promise<Result<CapturaId, DomainError>>;
}

export interface Relogio {
  agora(): Date;
}
