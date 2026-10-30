import { Controller, Get, Header, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import type { ConsultaDeProposicoes } from '@prometeu/consulta';
import type { Pagina, ProposicaoDetalhada, ProposicaoResumo } from '@prometeu/contracts';
import { z } from 'zod';

import { CACHE_PUBLICO, CASAS, ler, paginacao } from '../dados-abertos.js';

export const CONSULTA_DE_PROPOSICOES = Symbol('ConsultaDeProposicoes');

const filtro = paginacao.extend({
  casa: z.enum(['camara', 'senado']).optional(),
  tipo: z.enum(['PEC', 'PLP', 'PL', 'MPV', 'PDL']).optional(),
});

/** Proposições normativas: autoria, situação, tramitação e votações (ADR-0008). */
@Controller('v1/proposicoes')
export class ProposicoesController {
  constructor(
    @Inject(CONSULTA_DE_PROPOSICOES) private readonly proposicoes: ConsultaDeProposicoes,
  ) {}

  /** A movimentada por último primeiro. */
  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async listar(@Query() query: Record<string, unknown>): Promise<Pagina<ProposicaoResumo>> {
    const { casa, tipo, pagina, itens } = ler(filtro, query);
    return this.proposicoes.listar({
      casa: casa === undefined ? undefined : CASAS[casa],
      sigla: tipo,
      pagina,
      itensPorPagina: itens,
    });
  }

  @Get(':proposicaoId')
  @Header('Cache-Control', CACHE_PUBLICO)
  async buscar(@Param('proposicaoId') proposicaoId: string): Promise<ProposicaoDetalhada> {
    const proposicao = await this.proposicoes.buscar(proposicaoId);
    if (!proposicao) throw new NotFoundException({ mensagem: 'Proposição não encontrada.' });
    return proposicao;
  }
}
