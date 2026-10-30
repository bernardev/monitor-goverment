import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// Formato das entradas da API editorial. Aqui só se confere a forma (tipos, tamanhos); as regras de
// negócio ficam no domínio e voltam como erro de negócio (422).

const uuid = z.uuid();
const data = z.iso.datetime({ offset: true }).transform((texto) => new Date(texto));

const localizacao = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('pagina'), pagina: z.number().int().min(1) }),
  z.object({
    tipo: z.literal('intervalo_de_tempo'),
    inicioEmSegundos: z.number().min(0),
    fimEmSegundos: z.number().min(0),
  }),
]);

export const fonte = z.object({
  tipo: z.string().max(40),
  capturaId: uuid,
  citacaoLiteral: z.string().max(5000),
  localizacao,
  dataDaDeclaracao: data,
});

export const novaPromessa = z.object({
  pessoaId: uuid,
  candidaturaId: uuid.optional(),
  mandatoId: uuid.optional(),
  texto: z.string().max(1000),
  tema: z.string().max(60),
  mensurabilidade: z.string().max(40),
  competencia: z.string().max(40),
  meta: z.object({ descricao: z.string().max(1000), prazo: data.optional() }).optional(),
  fonte,
});

export const propostaDeVeredito = z.object({
  veredito: z.string().max(40),
  justificativa: z.string().max(5000),
  evidencias: z.array(uuid).min(1).max(50),
  fundamento: z
    .discriminatedUnion('tipo', [
      z.object({ tipo: z.literal('mandato_encerrado') }),
      z.object({ tipo: z.literal('ato_em_sentido_contrario'), evidenciaId: uuid }),
    ])
    .optional(),
  errata: z.boolean().optional(),
});

export const recusa = z.object({ motivo: z.string().max(2000) });

export const captura = z.object({ url: z.url({ protocol: /^https$/ }).max(2000) });

/** Confere o corpo da requisição; fora do formato, 400 com a lista de problemas. */
export function ler<S extends z.ZodType>(esquema: S, corpo: unknown): z.output<S> {
  const lido = esquema.safeParse(corpo);
  if (!lido.success) {
    throw new BadRequestException({
      mensagem: 'Requisição fora do formato.',
      problemas: lido.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }
  return lido.data;
}
