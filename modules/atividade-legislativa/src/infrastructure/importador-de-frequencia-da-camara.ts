import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type {
  RegistrarFrequencia,
  RegistrarFrequenciaInput,
} from '../application/registrar-frequencia.js';
import type { CategoriaDoMotivo } from '../domain/motivo-da-ausencia.js';
import type { Situacao } from '../domain/situacao.js';
import { camaraFrequenciaDia, camaraMatricula } from './prata-da-camara.js';

/** Grafias da Câmara (contrato `camara_frequencia_dia`). O "(~)" não tem legenda pública. */
const SITUACAO: Readonly<Record<string, Situacao>> = {
  Presença: 'presente',
  'Presença (~)': 'presente',
  Ausência: 'ausente',
  'Ausência justificada': 'ausencia_justificada',
};

/** Justificativas do Ato da Mesa 66/2010, comparadas sem acento e sem caixa. */
const MOTIVOS: readonly (readonly [RegExp, CategoriaDoMotivo])[] = [
  [/tratamento de saude/, 'licenca_saude'],
  [/gestante|maternidade/, 'licenca_gestante'],
  [/paternidade/, 'licenca_paternidade'],
  [/missao/, 'missao_autorizada'],
  [/decisao da mesa/, 'decisao_da_mesa'],
];

export interface FalhaDeImportacao {
  readonly codigoNaFonte: string;
  readonly erro: string;
  readonly mensagem: string;
}

export interface ResumoDaImportacao {
  readonly loteId: string;
  readonly lidos: number;
  readonly novos: number;
  readonly falhas: readonly FalhaDeImportacao[];
}

/**
 * Camada anticorrupção da Câmara (ADR-0005): traduz a frequência da prata para a linguagem deste
 * contexto. Nenhuma grafia ou convenção da Câmara passa daqui.
 *
 * Uma linha recusada não impede as outras; ela volta no resumo para ser investigada.
 */
export class ImportadorDeFrequenciaDaCamara {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarFrequencia,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select({ dia: camaraFrequenciaDia, idDeputado: camaraMatricula.idDeputado })
      .from(camaraFrequenciaDia)
      .leftJoin(camaraMatricula, eq(camaraMatricula.matricula, camaraFrequenciaDia.matricula))
      .where(eq(camaraFrequenciaDia.loteId, loteId))
      .orderBy(camaraFrequenciaDia.matricula, camaraFrequenciaDia.dia);

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const { dia, idDeputado } of linhas) {
      const codigoNaFonte = `matricula:${String(dia.matricula)}:${dia.dia}`;
      const entrada = idDeputado === null ? undefined : paraEntrada(dia, idDeputado);
      if (entrada === undefined) {
        falhas.push({
          codigoNaFonte,
          erro:
            idDeputado === null
              ? 'frequencia.matricula_desconhecida'
              : 'frequencia.grafia_desconhecida',
          mensagem: `Linha da prata sem tradução: matrícula ${String(dia.matricula)}, "${dia.frequencia}".`,
        });
        continue;
      }
      const resultado = await this.registrar.execute(entrada);
      if (resultado.ok) {
        if (resultado.value.novo) novos += 1;
      } else {
        falhas.push({
          codigoNaFonte,
          erro: resultado.error.code,
          mensagem: resultado.error.message,
        });
      }
    }
    return { loteId, lidos: linhas.length, novos, falhas };
  }
}

function paraEntrada(
  dia: typeof camaraFrequenciaDia.$inferSelect,
  idDeputado: number,
): RegistrarFrequenciaInput | undefined {
  const situacao = SITUACAO[dia.frequencia];
  const sessoes = dia.sessoes.map((s) => ({
    descricao: s.descricao,
    situacao: SITUACAO[s.frequencia],
  }));
  if (situacao === undefined || sessoes.some((s) => s.situacao === undefined)) return undefined;
  return {
    casa: 'camara_dos_deputados',
    parlamentar: { fonte: 'camara', codigo: String(idDeputado) },
    dia: dia.dia,
    situacao,
    // A Câmara só aceita a justificativa quando marca o dia como "Ausência justificada"; um texto em
    // outro dia não é motivo reconhecido pela casa.
    motivo:
      situacao === 'ausencia_justificada' && dia.justificativa !== null
        ? { categoria: categoria(dia.justificativa), descricaoNaFonte: dia.justificativa }
        : null,
    registroNaFonte: dia.frequencia,
    sessoes: sessoes.map((s) => ({ descricao: s.descricao, presente: s.situacao === 'presente' })),
    origem: {
      fonte: dia.origemFonte,
      url: dia.origemUrl,
      coletadaEm: dia.origemColetadaEm,
      sha256: dia.origemSha256,
      caminho: dia.origemCaminho,
      tipoDeConteudo: dia.origemTipoDeConteudo,
    },
  };
}

function categoria(justificativa: string): CategoriaDoMotivo {
  const comparavel = justificativa
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return MOTIVOS.find(([padrao]) => padrao.test(comparavel))?.[1] ?? 'outro';
}
