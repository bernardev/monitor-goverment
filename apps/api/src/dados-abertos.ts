import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// Regras comuns da API pública de dados abertos (ADR-0008): cache, ids e leitura da query.

/** Dados públicos mudam no máximo uma vez por coleta: a CDN pode servir por alguns minutos. */
export const CACHE_PUBLICO = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Sem período na query, a consulta cobre os últimos 90 dias; no máximo um ano por consulta. */
const DIAS_PADRAO = 90;
const DIAS_NO_MAXIMO = 366;
const UM_DIA = 86_400_000;

const dia = z.iso.date({ message: 'use o formato aaaa-mm-dd' });

/** `de` e `ate` em dias do calendário de Brasília, inclusive nas duas pontas. */
export const periodo = z
  .object({ de: dia.optional(), ate: dia.optional() })
  .transform(({ de, ate }) => {
    const fim = ate ?? hojeEmBrasilia();
    return { de: de ?? somarDias(fim, -(DIAS_PADRAO - 1)), ate: fim };
  })
  .refine(({ de, ate }) => de <= ate, { message: '"de" precisa ser anterior a "ate"' })
  .refine(({ de, ate }) => diasEntre(de, ate) < DIAS_NO_MAXIMO, {
    message: `o período pode ter no máximo ${String(DIAS_NO_MAXIMO)} dias`,
  });

/** Como a query nomeia as casas, e o nome delas na API. */
export const CASAS = { camara: 'camara_dos_deputados', senado: 'senado_federal' } as const;

export const paginacao = z.object({
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  itens: z.coerce.number().int().min(1).max(100).default(50),
});

/** Lê a query com o esquema; parâmetro inválido vira 400 com a lista de problemas. */
export function ler<T extends z.ZodType>(esquema: T, query: Record<string, unknown>): z.output<T> {
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
