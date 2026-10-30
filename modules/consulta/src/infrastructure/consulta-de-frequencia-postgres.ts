import type {
  CategoriaDoMotivo,
  DiaDeFrequencia,
  FrequenciaDoParlamentar,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

import type { ConsultaDeFrequencia, PeriodoDeFrequencia } from '../application/portas.js';
import { captura, frequencia } from './esquema.js';

export class ConsultaDeFrequenciaPostgres implements ConsultaDeFrequencia {
  constructor(private readonly banco: BancoDoContexto) {}

  async doParlamentar(
    pessoaId: string,
    periodo: PeriodoDeFrequencia,
  ): Promise<FrequenciaDoParlamentar> {
    const linhas = await this.banco.drizzle
      .select({ frequencia, captura })
      .from(frequencia)
      .leftJoin(captura, eq(captura.capturaId, frequencia.capturaId))
      .where(
        and(
          eq(frequencia.pessoaId, pessoaId),
          gte(frequencia.dia, periodo.de),
          lte(frequencia.dia, periodo.ate),
        ),
      )
      .orderBy(desc(frequencia.dia), frequencia.casa);

    const dias = linhas.map(({ frequencia: f, captura: c }): DiaDeFrequencia => ({
      dia: f.dia,
      casa: f.casa as DiaDeFrequencia['casa'],
      situacao: f.situacao as DiaDeFrequencia['situacao'],
      motivo:
        f.motivoCategoria === null
          ? null
          : {
              categoria: f.motivoCategoria as CategoriaDoMotivo,
              descricaoNaFonte: f.motivoDescricao ?? '',
            },
      registroNaFonte: f.registroNaFonte,
      sessoes: f.sessoes,
      fonte: {
        capturaId: f.capturaId,
        url: c?.url ?? null,
        coletadaEm: c?.coletadaEm.toISOString() ?? null,
      },
    }));
    return { pessoaId, de: periodo.de, ate: periodo.ate, resumo: resumir(dias), dias };
  }
}

function resumir(dias: readonly DiaDeFrequencia[]): FrequenciaDoParlamentar['resumo'] {
  const porMotivo = new Map<CategoriaDoMotivo, number>();
  for (const { motivo } of dias) {
    if (motivo) porMotivo.set(motivo.categoria, (porMotivo.get(motivo.categoria) ?? 0) + 1);
  }
  const contar = (situacao: DiaDeFrequencia['situacao']) =>
    dias.filter((d) => d.situacao === situacao).length;
  return {
    diasComSessao: dias.length,
    presencas: contar('presente'),
    ausenciasJustificadas: contar('ausencia_justificada'),
    ausenciasSemJustificativa: contar('ausente'),
    porMotivo: [...porMotivo]
      .map(([categoria, quantos]) => ({ categoria, dias: quantos }))
      .sort((a, b) => b.dias - a.dias || a.categoria.localeCompare(b.categoria)),
  };
}
