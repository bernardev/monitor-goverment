import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { CodigoIbge, type DomainError, Result } from '@prometeu/shared-kernel';
import { eq } from 'drizzle-orm';

import type {
  SincronizarAgentePublico,
  SincronizarAgentePublicoInput,
} from '../application/sincronizar-agente-publico.js';
import { camaraDeputado, camaraLegislatura } from './prata-da-camara.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

type Deputado = typeof camaraDeputado.$inferSelect;
type Legislatura = typeof camaraLegislatura.$inferSelect;
type Periodo = SincronizarAgentePublicoInput['mandatos'][number];

/** Como a Câmara escreve "sem partido" (deputado desfiliado). */
const SEM_PARTIDO = 'S.PART.';

/**
 * Camada anticorrupção da Câmara (ADR-0005): traduz as linhas prata de um lote para a linguagem deste
 * contexto. Nenhum nome de coluna ou convenção da Câmara passa daqui.
 *
 * A prata tem uma linha por deputado e legislatura. As linhas do mesmo deputado vão juntas para o
 * domínio: os mandatos de todas as legislaturas, e nome, partido e foto da mais recente. Aplicar uma
 * legislatura de cada vez trocaria o partido para o antigo e de volta a cada lote.
 *
 * Um deputado recusado pelo domínio não impede os outros; ele volta no resumo para ser investigado.
 */
export class ImportadorDeDeputadosDaCamara {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly sincronizar: SincronizarAgentePublico,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select({ deputado: camaraDeputado, legislatura: camaraLegislatura })
      .from(camaraDeputado)
      .innerJoin(
        camaraLegislatura,
        eq(camaraLegislatura.idLegislatura, camaraDeputado.idLegislatura),
      )
      .where(eq(camaraDeputado.loteId, loteId))
      .orderBy(camaraDeputado.idDeputado, camaraDeputado.idLegislatura);

    const porDeputado = new Map<number, (typeof linhas)[number][]>();
    for (const linha of linhas) {
      const doDeputado = porDeputado.get(linha.deputado.idDeputado) ?? [];
      doDeputado.push(linha);
      porDeputado.set(linha.deputado.idDeputado, doDeputado);
    }

    let pessoasNovas = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const [idDeputado, legislaturas] of porDeputado) {
      // Em ordem de legislatura: a última é a mais recente.
      const atual = legislaturas.at(-1);
      if (atual === undefined) continue;
      const mandatos = periodos(legislaturas);
      const resultado = mandatos.ok
        ? await this.sincronizar.execute(paraEntrada(atual.deputado, mandatos.value))
        : mandatos;
      if (resultado.ok) {
        if (resultado.value.pessoaNova) pessoasNovas += 1;
      } else {
        falhas.push({
          codigoNaFonte: String(idDeputado),
          erro: resultado.error.code,
          mensagem: resultado.error.message,
        });
      }
    }
    return { loteId, lidos: linhas.length, pessoasNovas, falhas };
  }
}

/**
 * Cada período de exercício é um mandato, na UF pela qual o deputado foi eleito naquela legislatura.
 * O que está em curso termina, no máximo, com a legislatura.
 */
function periodos(
  legislaturas: readonly { deputado: Deputado; legislatura: Legislatura }[],
): Result<Periodo[], DomainError> {
  const mandatos: Periodo[] = [];
  for (const { deputado, legislatura } of legislaturas) {
    const circunscricao = CodigoIbge.daUf(deputado.siglaUf);
    if (!circunscricao.ok) return circunscricao;
    for (const exercicio of deputado.exercicios) {
      mandatos.push({
        cargo: 'deputado_federal',
        circunscricao: circunscricao.value.valor,
        inicio: new Date(exercicio.inicio),
        fim:
          exercicio.fim === null ? fimDaLegislatura(legislatura.dataFim) : new Date(exercicio.fim),
      });
    }
  }
  return Result.ok(mandatos);
}

function paraEntrada(deputado: Deputado, mandatos: Periodo[]): SincronizarAgentePublicoInput {
  return {
    identificador: { fonte: 'camara', codigo: String(deputado.idDeputado) },
    nome: deputado.nome,
    siglaPartido: deputado.siglaPartido === SEM_PARTIDO ? null : deputado.siglaPartido,
    urlDaFoto: deputado.urlFoto,
    mandatos,
    origem: {
      fonte: deputado.origemFonte,
      url: deputado.origemUrl,
      coletadaEm: deputado.origemColetadaEm,
      sha256: deputado.origemSha256,
      caminho: deputado.origemCaminho,
      tipoDeConteudo: deputado.origemTipoDeConteudo,
    },
  };
}

/**
 * A Câmara informa a data sem hora: a legislatura termina no último instante do dia, no horário de
 * Brasília (sem horário de verão desde 2019).
 */
function fimDaLegislatura(fim: string): Date {
  return new Date(`${fim}T23:59:59.999-03:00`);
}
