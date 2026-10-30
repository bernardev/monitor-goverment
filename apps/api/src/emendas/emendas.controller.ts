import { Controller, Get, Header, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import type { ConsultaDeEmendas } from '@prometeu/consulta';
import type { EmendaDetalhada, EmendaResumo, Pagina } from '@prometeu/contracts';
import { z } from 'zod';

import { CACHE_PUBLICO, ler, paginacao } from '../dados-abertos.js';

export const CONSULTA_DE_EMENDAS = Symbol('ConsultaDeEmendas');

const filtro = paginacao.extend({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  tipo: z.enum(['individual', 'bancada', 'comissao', 'relator']).optional(),
  uf: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'use a sigla da UF, como SP')
    .optional(),
});

/** Emendas parlamentares ao orçamento: autor, destino e execução (ADR-0008). */
@Controller('v1/emendas')
export class EmendasController {
  constructor(@Inject(CONSULTA_DE_EMENDAS) private readonly emendas: ConsultaDeEmendas) {}

  /** Orçamento mais recente primeiro; no mesmo ano, a de maior empenho. */
  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async listar(@Query() query: Record<string, unknown>): Promise<Pagina<EmendaResumo>> {
    const { ano, tipo, uf, pagina, itens } = ler(filtro, query);
    return this.emendas.listar({ ano, tipo, uf, pagina, itensPorPagina: itens });
  }

  @Get(':emendaId')
  @Header('Cache-Control', CACHE_PUBLICO)
  async buscar(@Param('emendaId') emendaId: string): Promise<EmendaDetalhada> {
    const emenda = await this.emendas.buscar(emendaId);
    if (!emenda) throw new NotFoundException({ mensagem: 'Emenda não encontrada.' });
    return emenda;
  }
}
