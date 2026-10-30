import {
  type ConsultaDePessoas,
  type ParlamentarEmExercicio,
  pessoaPeloNome,
} from '@prometeu/agentes-publicos';

import type { AutoresDasEmendas, Relogio } from '../application/portas.js';
import { PessoaId } from '../domain/identificadores.js';
import { confiavel } from './persistencia.js';

/** Por quanto tempo a lista de parlamentares de um ano vale sem consultar de novo. */
const VALIDADE_EM_MS = 10 * 60 * 1000;

/**
 * Pergunta a Agentes Públicos quem é o autor (serviço de host aberto). A emenda ao orçamento de um ano
 * é apresentada no fim do ano anterior: os candidatos são os parlamentares em exercício nele. A lista
 * de cada ano é lembrada por alguns minutos, o bastante para uma importação inteira.
 */
export class AutoresEmAgentesPublicos implements AutoresDasEmendas {
  private readonly candidatos = new Map<
    number,
    { lista: Promise<ParlamentarEmExercicio[]>; em: number }
  >();

  constructor(
    private readonly pessoas: Pick<ConsultaDePessoas, 'parlamentaresEmExercicio'>,
    private readonly relogio: Relogio,
  ) {}

  async parlamentarPeloNome(nome: string, anoDoOrcamento: number): Promise<PessoaId | undefined> {
    const id = pessoaPeloNome(nome, await this.parlamentaresDe(anoDoOrcamento - 1));
    return id === undefined ? undefined : confiavel(PessoaId.de(id));
  }

  private parlamentaresDe(ano: number): Promise<ParlamentarEmExercicio[]> {
    const agora = this.relogio.agora().getTime();
    const lembrada = this.candidatos.get(ano);
    if (lembrada && agora - lembrada.em < VALIDADE_EM_MS) return lembrada.lista;
    const lista = this.pessoas.parlamentaresEmExercicio(
      new Date(`${String(ano)}-01-01T00:00:00.000-03:00`),
      new Date(`${String(ano)}-12-31T23:59:59.999-03:00`),
    );
    this.candidatos.set(ano, { lista, em: agora });
    // Uma consulta que falhou não fica lembrada: a próxima tenta de novo.
    lista.catch(() => this.candidatos.delete(ano));
    return lista;
  }
}
