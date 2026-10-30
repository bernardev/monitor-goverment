// Implementações em memória das portas, para testar casos de uso sem banco (docs/engenharia/convencoes.md).

import type { DomainEvent } from '@prometeu/shared-kernel';

import type { ConsultaDeMandatos, PromessaRepository, Relogio } from '../application/portas.js';
import type { MandatoId, PromessaId } from '../domain/identificadores.js';
import type { Promessa } from '../domain/promessa.js';

export class PromessaRepositoryEmMemoria implements PromessaRepository {
  private readonly promessas = new Map<string, Promessa>();
  /** O que iria para a outbox, na ordem em que foi salvo. */
  readonly eventos: DomainEvent[] = [];

  buscarPorId(id: PromessaId): Promise<Promessa | undefined> {
    return Promise.resolve(this.promessas.get(id.valor));
  }

  salvar(promessa: Promessa): Promise<void> {
    this.promessas.set(promessa.id.valor, promessa);
    this.eventos.push(...promessa.pullDomainEvents());
    return Promise.resolve();
  }

  tiposDosEventos(): string[] {
    return this.eventos.map((evento) => evento.tipo);
  }
}

export class RelogioFixo implements Relogio {
  constructor(private instante: Date) {}

  agora(): Date {
    return new Date(this.instante);
  }

  avancarPara(instante: Date): void {
    this.instante = instante;
  }
}

export class MandatosEmMemoria implements ConsultaDeMandatos {
  private readonly fins = new Map<string, Date>();

  encerrar(mandato: MandatoId, em: Date): void {
    this.fins.set(mandato.valor, em);
  }

  fimDoMandato(mandato: MandatoId): Promise<Date | undefined> {
    return Promise.resolve(this.fins.get(mandato.valor));
  }
}
