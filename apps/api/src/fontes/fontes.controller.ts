import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { ConsultaDeFontes } from '@prometeu/consulta';
import type { SituacaoDaFonte } from '@prometeu/contracts';

import { CACHE_PUBLICO } from '../dados-abertos.js';

export const CONSULTA_DE_FONTES = Symbol('ConsultaDeFontes');

/** Transparência operacional: quando cada fonte oficial foi coletada pela última vez (ADR-0008). */
@Controller('v1/fontes')
export class FontesController {
  constructor(@Inject(CONSULTA_DE_FONTES) private readonly fontes: ConsultaDeFontes) {}

  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async situacao(): Promise<SituacaoDaFonte[]> {
    return this.fontes.situacao();
  }
}
