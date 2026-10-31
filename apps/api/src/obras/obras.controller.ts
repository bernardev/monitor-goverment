import { Controller, Get, Header, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import type { ConsultaDeObras } from '@prometeu/consulta';
import type { ObraDetalhada, ObraResumo, Pagina } from '@prometeu/contracts';
import { z } from 'zod';

import { CACHE_PUBLICO, ler, municipio, nome, paginacao } from '../dados-abertos.js';

export const CONSULTA_DE_OBRAS = Symbol('ConsultaDeObras');

const filtro = paginacao.extend({
  uf: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'use a sigla da UF, como SP')
    .optional(),
  situacao: z
    .enum(['planejada', 'em_execucao', 'paralisada', 'concluida', 'cancelada', 'inacabada'])
    .optional(),
  municipio: municipio.optional(),
  nome: nome.optional(),
});

/** Obras pagas com emendas parlamentares: situação, medição e as emendas que as pagam (ADR-0008). */
@Controller('v1/obras')
export class ObrasController {
  constructor(@Inject(CONSULTA_DE_OBRAS) private readonly obras: ConsultaDeObras) {}

  /** A de maior investimento previsto primeiro. */
  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async listar(@Query() query: Record<string, unknown>): Promise<Pagina<ObraResumo>> {
    const { uf, situacao, municipio: local, nome: parteDoNome, pagina, itens } = ler(filtro, query);
    return this.obras.listar({
      uf,
      situacao,
      municipio: local,
      nome: parteDoNome,
      pagina,
      itensPorPagina: itens,
    });
  }

  @Get(':obraId')
  @Header('Cache-Control', CACHE_PUBLICO)
  async buscar(@Param('obraId') obraId: string): Promise<ObraDetalhada> {
    const obra = await this.obras.buscar(obraId);
    if (!obra) throw new NotFoundException({ mensagem: 'Obra não encontrada.' });
    return obra;
  }
}
