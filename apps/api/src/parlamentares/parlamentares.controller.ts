import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import type { ConsultaDeParlamentares } from '@prometeu/consulta';
import type { Pagina, ParlamentarResumo, PerfilDeParlamentar } from '@prometeu/contracts';
import { z } from 'zod';

export const CONSULTA_DE_PARLAMENTARES = Symbol('ConsultaDeParlamentares');

/** Dados públicos mudam no máximo uma vez por coleta: a CDN pode servir por alguns minutos. */
const CACHE_PUBLICO = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const filtro = z.object({
  uf: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'use a sigla da UF, como SP')
    .optional(),
  partido: z.string().trim().min(1).max(20).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  itens: z.coerce.number().int().min(1).max(100).default(50),
});

/** API pública de dados abertos, somente leitura (ADR-0008). */
@Controller('v1/parlamentares')
export class ParlamentaresController {
  constructor(
    @Inject(CONSULTA_DE_PARLAMENTARES) private readonly consulta: ConsultaDeParlamentares,
  ) {}

  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async listar(@Query() query: Record<string, unknown>): Promise<Pagina<ParlamentarResumo>> {
    const lido = filtro.safeParse(query);
    if (!lido.success) {
      throw new BadRequestException({
        mensagem: 'Parâmetros inválidos.',
        problemas: lido.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      });
    }
    const { uf, partido, pagina, itens } = lido.data;
    return this.consulta.listar({ uf, partido, pagina, itensPorPagina: itens });
  }

  @Get(':pessoaId')
  @Header('Cache-Control', CACHE_PUBLICO)
  async buscar(@Param('pessoaId') pessoaId: string): Promise<PerfilDeParlamentar> {
    const perfil = UUID.test(pessoaId)
      ? await this.consulta.buscar(pessoaId.toLowerCase())
      : undefined;
    if (!perfil) throw new NotFoundException({ mensagem: 'Parlamentar não encontrado.' });
    return perfil;
  }
}
