import { Controller, Get, Header, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import type {
  ConsultaDeFrequencia,
  ConsultaDeParlamentares,
  ConsultaDeVotacoes,
} from '@prometeu/consulta';
import type {
  FrequenciaDoParlamentar,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
  VotosDoParlamentar,
} from '@prometeu/contracts';
import { z } from 'zod';

import { CACHE_PUBLICO, ler, paginacao, periodo, UUID } from '../dados-abertos.js';

export const CONSULTA_DE_PARLAMENTARES = Symbol('ConsultaDeParlamentares');
export const CONSULTA_DE_FREQUENCIA = Symbol('ConsultaDeFrequencia');
export const CONSULTA_DE_VOTACOES = Symbol('ConsultaDeVotacoes');

const filtro = paginacao.extend({
  uf: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'use a sigla da UF, como SP')
    .optional(),
  partido: z.string().trim().min(1).max(20).optional(),
});

/** API pública de dados abertos, somente leitura (ADR-0008). */
@Controller('v1/parlamentares')
export class ParlamentaresController {
  constructor(
    @Inject(CONSULTA_DE_PARLAMENTARES) private readonly consulta: ConsultaDeParlamentares,
    @Inject(CONSULTA_DE_FREQUENCIA) private readonly frequencia: ConsultaDeFrequencia,
    @Inject(CONSULTA_DE_VOTACOES) private readonly votacoes: ConsultaDeVotacoes,
  ) {}

  /** Quem está no cargo hoje. */
  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async listar(@Query() query: Record<string, unknown>): Promise<Pagina<ParlamentarResumo>> {
    const { uf, partido, pagina, itens } = ler(filtro, query);
    return this.consulta.listar({ uf, partido, pagina, itensPorPagina: itens });
  }

  @Get(':pessoaId')
  @Header('Cache-Control', CACHE_PUBLICO)
  async buscar(@Param('pessoaId') pessoaId: string): Promise<PerfilDeParlamentar> {
    return this.perfil(pessoaId);
  }

  /** Presenças e ausências no plenário, dia a dia, com o motivo de cada ausência justificada. */
  @Get(':pessoaId/frequencia')
  @Header('Cache-Control', CACHE_PUBLICO)
  async frequenciaDe(
    @Param('pessoaId') pessoaId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<FrequenciaDoParlamentar> {
    const intervalo = ler(periodo, query);
    const perfil = await this.perfil(pessoaId);
    return this.frequencia.doParlamentar(perfil.pessoaId, intervalo);
  }

  /** O voto em cada votação nominal do plenário, e a situação do dia quando não votou. */
  @Get(':pessoaId/votos')
  @Header('Cache-Control', CACHE_PUBLICO)
  async votosDe(
    @Param('pessoaId') pessoaId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<VotosDoParlamentar> {
    const intervalo = ler(periodo, query);
    const perfil = await this.perfil(pessoaId);
    return this.votacoes.doParlamentar(perfil.pessoaId, intervalo);
  }

  private async perfil(pessoaId: string): Promise<PerfilDeParlamentar> {
    const perfil = UUID.test(pessoaId)
      ? await this.consulta.buscar(pessoaId.toLowerCase())
      : undefined;
    if (!perfil) throw new NotFoundException({ mensagem: 'Parlamentar não encontrado.' });
    return perfil;
  }
}
