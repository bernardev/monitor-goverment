import type { Captura } from '../domain/captura.js';
import type { HashSha256 } from '../domain/hash-sha256.js';

export interface CapturaRepository {
  buscarPorHash(sha256: HashSha256): Promise<Captura | undefined>;
  /** Grava a captura e seus eventos na mesma transação (ADR-0007). */
  salvar(captura: Captura): Promise<void>;
}

export interface Relogio {
  agora(): Date;
}
