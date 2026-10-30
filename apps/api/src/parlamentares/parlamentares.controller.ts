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
import type { ConsultaDeFrequencia, ConsultaDeParlamentares } from '@prometeu/consulta';
import type {
  FrequenciaDoParlamentar,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
} from '@prometeu/contracts';
import { z } from 'zod';

export const CONSULTA_DE_PARLAMENTARES = Symbol('ConsultaDeParlamentares');
export const CONSULTA_DE_FREQUENCIA = Symbol('ConsultaDeFrequencia');

/** Sem período na query, a frequência cobre os últimos 90 dias; no máximo um ano por consulta. */
const DIAS_PADRAO = 90;
const DIAS_NO_MAXIMO = 366;
const UM_DIA = 86_400_000;

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

const dia = z.iso.date({ message: 'use o formato aaaa-mm-dd' });
const periodo = z
  .object({ de: dia.optional(), ate: dia.optional() })
  .transform(({ de, ate }) => {
    const fim = ate ?? hojeEmBrasilia();
    return { de: de ?? somarDias(fim, -(DIAS_PADRAO - 1)), ate: fim };
  })
  .refine(({ de, ate }) => de <= ate, { message: '"de" precisa ser anterior a "ate"' })
  .refine(({ de, ate }) => diasEntre(de, ate) < DIAS_NO_MAXIMO, {
    message: `o período pode ter no máximo ${String(DIAS_NO_MAXIMO)} dias`,
  });

/** API pública de dados abertos, somente leitura (ADR-0008). */
@Controller('v1/parlamentares')
export class ParlamentaresController {
  constructor(
    @Inject(CONSULTA_DE_PARLAMENTARES) private readonly consulta: ConsultaDeParlamentares,
    @Inject(CONSULTA_DE_FREQUENCIA) private readonly frequencia: ConsultaDeFrequencia,
  ) {}

  @Get()
  @Header('Cache-Control', CACHE_PUBLICO)
  async listar(@Query() query: Record<string, unknown>): Promise<Pagina<ParlamentarResumo>> {
    const { uf, partido, pagina, itens } = ler(filtro, query);
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

  /** Presenças e ausências no plenário, dia a dia, com o motivo de cada ausência justificada. */
  @Get(':pessoaId/frequencia')
  @Header('Cache-Control', CACHE_PUBLICO)
  async frequenciaDe(
    @Param('pessoaId') pessoaId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<FrequenciaDoParlamentar> {
    const intervalo = ler(periodo, query);
    const perfil = UUID.test(pessoaId)
      ? await this.consulta.buscar(pessoaId.toLowerCase())
      : undefined;
    if (!perfil) throw new NotFoundException({ mensagem: 'Parlamentar não encontrado.' });
    return this.frequencia.doParlamentar(perfil.pessoaId, intervalo);
  }
}

function ler<T extends z.ZodType>(esquema: T, query: Record<string, unknown>): z.output<T> {
  const lido = esquema.safeParse(query);
  if (!lido.success) {
    throw new BadRequestException({
      mensagem: 'Parâmetros inválidos.',
      problemas: lido.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }
  return lido.data;
}

function hojeEmBrasilia(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function somarDias(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + dias * UM_DIA).toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / UM_DIA;
}
