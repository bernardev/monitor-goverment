import type { ConsultaDePessoas } from '@prometeu/agentes-publicos';

import type { ParlamentarNaFonte, PessoasDosParlamentares } from '../application/portas.js';
import { PessoaId } from '../domain/identificadores.js';
import { confiavel } from './persistencia.js';

/** Atividade Legislativa pergunta a Agentes Públicos quem é o parlamentar (serviço de host aberto). */
export class PessoasEmAgentesPublicos implements PessoasDosParlamentares {
  constructor(private readonly pessoas: ConsultaDePessoas) {}

  async pessoaDe(parlamentar: ParlamentarNaFonte): Promise<PessoaId | undefined> {
    const id = await this.pessoas.porCodigo(parlamentar);
    return id === undefined ? undefined : confiavel(PessoaId.de(id));
  }
}
