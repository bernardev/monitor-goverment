import type { Cargo, ConsultaDeMandatos } from '@prometeu/agentes-publicos';
import type { DomainError, Result } from '@prometeu/shared-kernel';

import type { MandatosDosParlamentares, ParlamentarNaFonte } from '../application/portas.js';
import type { CasaLegislativa } from '../domain/casa-legislativa.js';
import type { DiaDeSessao } from '../domain/dia-de-sessao.js';
import { MandatoId, PessoaId } from '../domain/identificadores.js';
import type { MandatoVigente } from '../domain/registro-de-frequencia.js';

const CARGO_NA_CASA: Readonly<Record<CasaLegislativa, Cargo>> = {
  camara_dos_deputados: 'deputado_federal',
  senado_federal: 'senador',
};

/** Atividade Legislativa é cliente de Agentes Públicos, pelo serviço de host aberto. */
export class MandatosEmAgentesPublicos implements MandatosDosParlamentares {
  constructor(private readonly mandatos: Pick<ConsultaDeMandatos, 'vigente'>) {}

  async vigenteNoDia(
    parlamentar: ParlamentarNaFonte,
    casa: CasaLegislativa,
    dia: DiaDeSessao,
  ): Promise<MandatoVigente | undefined> {
    const publicado = await this.mandatos.vigente(parlamentar, CARGO_NA_CASA[casa], dia.meioDia);
    if (publicado === undefined) return undefined;
    return {
      mandato: confiavel(MandatoId.de(publicado.mandatoId)),
      pessoa: confiavel(PessoaId.de(publicado.pessoaId)),
      inicio: publicado.inicio,
      fim: publicado.fim,
    };
  }
}

function confiavel<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) {
    throw new Error(`Agentes Públicos devolveu um id inválido: ${resultado.error.message}`);
  }
  return resultado.value;
}
