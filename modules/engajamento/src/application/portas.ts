import type { Cidadao, CidadaoId } from '../domain/cidadao.js';

export interface CidadaoRepository {
  /** Sem nada guardado, devolve o cidadão sem acompanhamentos: a conta existe no provedor. */
  buscar(id: CidadaoId): Promise<Cidadao>;
  salvar(cidadao: Cidadao): Promise<void>;
  /** Apaga tudo o que o contexto guarda sobre a pessoa (LGPD, ADR-0014). */
  apagar(id: CidadaoId): Promise<void>;
}

export interface Relogio {
  agora(): Date;
}
