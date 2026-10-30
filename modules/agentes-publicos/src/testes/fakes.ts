import { type DomainError, Result } from '@prometeu/shared-kernel';

import type {
  OrigemDoDado,
  PessoaRepository,
  RegistroDeCapturas,
  Relogio,
} from '../application/portas.js';
import type { IdentificadorExterno } from '../domain/identificador-externo.js';
import { CapturaId } from '../domain/identificadores.js';
import type { Pessoa } from '../domain/pessoa.js';

export class PessoaRepositoryEmMemoria implements PessoaRepository {
  private readonly pessoas: Pessoa[] = [];
  readonly eventos: string[] = [];

  buscarPorIdentificador(identificador: IdentificadorExterno): Promise<Pessoa | undefined> {
    return Promise.resolve(
      this.pessoas.find((p) => p.identificadores.some((i) => i.equals(identificador))),
    );
  }

  salvar(pessoa: Pessoa): Promise<void> {
    if (!this.pessoas.includes(pessoa)) this.pessoas.push(pessoa);
    this.eventos.push(...pessoa.pullDomainEvents().map((e) => e.tipo));
    return Promise.resolve();
  }

  get quantidade(): number {
    return this.pessoas.length;
  }
}

/** Uma captura por hash, como o Acervo (ADR-0016). */
export class CapturasEmMemoria implements RegistroDeCapturas {
  readonly porHash = new Map<string, CapturaId>();
  private proxima = 1;

  registrar(origem: OrigemDoDado): Promise<Result<CapturaId, DomainError>> {
    const existente = this.porHash.get(origem.sha256);
    if (existente) return Promise.resolve(Result.ok(existente));
    const sufixo = String(this.proxima++).padStart(12, '0');
    const nova = CapturaId.de(`0192d5e0-2222-7000-8000-${sufixo}`);
    if (nova.ok) this.porHash.set(origem.sha256, nova.value);
    return Promise.resolve(nova);
  }
}

export class RelogioFixo implements Relogio {
  constructor(private readonly instante: Date) {}

  agora(): Date {
    return new Date(this.instante);
  }
}
