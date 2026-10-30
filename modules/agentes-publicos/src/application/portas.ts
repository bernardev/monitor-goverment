import type { DomainError, Result } from '@prometeu/shared-kernel';

import type { IdentificadorExterno } from '../domain/identificador-externo.js';
import type { CapturaId } from '../domain/identificadores.js';
import type { Pessoa } from '../domain/pessoa.js';

export interface PessoaRepository {
  buscarPorIdentificador(identificador: IdentificadorExterno): Promise<Pessoa | undefined>;
  /** Grava a pessoa e seus eventos na mesma transação (ADR-0007). */
  salvar(pessoa: Pessoa): Promise<void>;
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
