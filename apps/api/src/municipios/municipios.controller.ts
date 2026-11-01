import { Controller, Get, Header, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import type { ConsultaDeMunicipios } from '@prometeu/consulta';
import type { AutorNoMunicipio, MunicipioResumo } from '@prometeu/contracts';
import { z } from 'zod';

import { CACHE_PUBLICO, ler, nome } from '../dados-abertos.js';

export const CONSULTA_DE_MUNICIPIOS = Symbol('ConsultaDeMunicipios');

/**
 * Municípios que aparecem como destino de emenda ou local de obra, para achar o código IBGE pelo
 * nome e filtrar emendas e obras por ele (ADR-0008).
 */
@Controller('v1/municipios')
export class MunicipiosController {
  constructor(@Inject(CONSULTA_DE_MUNICIPIOS) private readonly municipios: ConsultaDeMunicipios) {}

  /** Até 20, pelo nome; os que começam com o termo primeiro. */
  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async buscar(@Query() query: Record<string, unknown>): Promise<MunicipioResumo[]> {
    const { nome: parteDoNome } = ler(z.object({ nome }), query);
    return this.municipios.buscar(parteDoNome);
  }

  @Get(':codigoIbge')
  @Header('Cache-Control', CACHE_PUBLICO)
  async porCodigo(@Param('codigoIbge') codigoIbge: string): Promise<MunicipioResumo> {
    const encontrado = await this.municipios.porCodigo(codigoIbge);
    if (!encontrado) throw new NotFoundException({ mensagem: 'Município não encontrado.' });
    return encontrado;
  }

  /** Quem mandou dinheiro de emenda para o município, de quem mais pagou para quem menos. */
  @Get(':codigoIbge/autores')
  @Header('Cache-Control', CACHE_PUBLICO)
  async autores(@Param('codigoIbge') codigoIbge: string): Promise<AutorNoMunicipio[]> {
    if (!(await this.municipios.porCodigo(codigoIbge))) {
      throw new NotFoundException({ mensagem: 'Município não encontrado.' });
    }
    return this.municipios.autoresDeEmendas(codigoIbge);
  }
}
