import type { MandatoId, PromessaId } from '../domain/identificadores.js';
import type { Promessa } from '../domain/promessa.js';

/**
 * Persistência do agregado. A implementação grava a promessa e os eventos de
 * `pullDomainEvents()` na outbox, na mesma transação (ADR-0007).
 */
export interface PromessaRepository {
  buscarPorId(id: PromessaId): Promise<Promessa | undefined>;
  salvar(promessa: Promessa): Promise<void>;
}

/** Fonte única do instante atual, para que os casos de uso sejam testáveis sem depender do relógio. */
export interface Relogio {
  agora(): Date;
}

/**
 * O que Compromissos precisa saber de Agentes Públicos (relação cliente-fornecedor, ver mapa de
 * contextos): quando um mandato termina. `undefined` significa mandato em curso.
 */
export interface ConsultaDeMandatos {
  fimDoMandato(mandato: MandatoId): Promise<Date | undefined>;
}
