import type { ConsultaDeMandatos as MandatosPublicados } from '@prometeu/agentes-publicos';

import type { ConsultaDeMandatos } from '../application/portas.js';
import type { MandatoId } from '../domain/identificadores.js';

/**
 * Compromissos é cliente de Agentes Públicos (mapa de contextos): a data de fim do mandato vem de lá,
 * pelo serviço de host aberto, e nunca da palavra de quem propõe o veredito.
 */
export class MandatosEmAgentesPublicos implements ConsultaDeMandatos {
  constructor(private readonly mandatos: Pick<MandatosPublicados, 'buscar'>) {}

  async fimDoMandato(mandato: MandatoId): Promise<Date | undefined> {
    return (await this.mandatos.buscar(mandato.valor))?.fim ?? undefined;
  }
}
