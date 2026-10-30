import { Controller, Get, Header, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import type { ConsultaDeVotacoes } from '@prometeu/consulta';
import type { Pagina, VotacaoNominalDetalhada, VotacaoNominalResumo } from '@prometeu/contracts';

import { z } from 'zod';

import { CACHE_PUBLICO, CASAS, ler, paginacao, periodo } from '../dados-abertos.js';
import { CONSULTA_DE_VOTACOES } from '../parlamentares/parlamentares.controller.js';

const filtro = periodo
  .and(paginacao)
  .and(z.object({ casa: z.enum(['camara', 'senado']).optional() }));

/** Votações nominais do plenário: placar, voto de cada parlamentar e as fontes (ADR-0008). */
@Controller('v1/votacoes')
export class VotacoesController {
  constructor(@Inject(CONSULTA_DE_VOTACOES) private readonly votacoes: ConsultaDeVotacoes) {}

  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async listar(@Query() query: Record<string, unknown>): Promise<Pagina<VotacaoNominalResumo>> {
    const { de, ate, pagina, itens, casa } = ler(filtro, query);
    return this.votacoes.listar({
      de,
      ate,
      casa: casa === undefined ? undefined : CASAS[casa],
      pagina,
      itensPorPagina: itens,
    });
  }

  @Get(':votacaoId')
  @Header('Cache-Control', CACHE_PUBLICO)
  async buscar(@Param('votacaoId') votacaoId: string): Promise<VotacaoNominalDetalhada> {
    const votacao = await this.votacoes.buscar(votacaoId);
    if (!votacao) throw new NotFoundException({ mensagem: 'Votação não encontrada.' });
    return votacao;
  }
}
