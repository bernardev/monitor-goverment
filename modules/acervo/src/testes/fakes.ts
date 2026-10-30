import type { CapturaRepository, Relogio } from '../application/portas.js';
import type { Captura } from '../domain/captura.js';
import type { HashSha256 } from '../domain/hash-sha256.js';

export class CapturaRepositoryEmMemoria implements CapturaRepository {
  readonly salvas: Captura[] = [];
  readonly eventos: string[] = [];

  buscarPorHash(sha256: HashSha256): Promise<Captura | undefined> {
    return Promise.resolve(this.salvas.find((c) => c.sha256.equals(sha256)));
  }

  salvar(captura: Captura): Promise<void> {
    this.salvas.push(captura);
    this.eventos.push(...captura.pullDomainEvents().map((e) => e.tipo));
    return Promise.resolve();
  }
}

export class RelogioFixo implements Relogio {
  constructor(private readonly instante: Date) {}

  agora(): Date {
    return new Date(this.instante);
  }
}
