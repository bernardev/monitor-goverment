import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { CodigoIbge } from '@prometeu/shared-kernel';
import { eq } from 'drizzle-orm';

import type {
  SincronizarAgentePublico,
  SincronizarAgentePublicoInput,
} from '../application/sincronizar-agente-publico.js';
import { camaraDeputado, camaraLegislatura } from './prata-da-camara.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

/** Como a Câmara escreve "sem partido" (deputado desfiliado). */
const SEM_PARTIDO = 'S.PART.';

/**
 * Camada anticorrupção da Câmara (ADR-0005): traduz as linhas prata de um lote para a linguagem deste
 * contexto. Nenhum nome de coluna ou convenção da Câmara passa daqui.
 *
 * Uma linha recusada pelo domínio não impede as outras; ela volta no resumo para ser investigada.
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

    let pessoasNovas = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const { deputado, legislatura } of linhas) {
      const codigoNaFonte = String(deputado.idDeputado);
      const circunscricao = CodigoIbge.daUf(deputado.siglaUf);
      const resultado = circunscricao.ok
        ? await this.sincronizar.execute(
            paraEntrada(deputado, legislatura, circunscricao.value.valor),
          )
        : circunscricao;
      if (resultado.ok) {
        if (resultado.value.pessoaNova) pessoasNovas += 1;
      } else {
        falhas.push({
          codigoNaFonte,
          erro: resultado.error.code,
          mensagem: resultado.error.message,
        });
      }
    }
    return { loteId, lidos: linhas.length, pessoasNovas, falhas };
  }
}

function paraEntrada(
  deputado: typeof camaraDeputado.$inferSelect,
  legislatura: typeof camaraLegislatura.$inferSelect,
  circunscricao: string,
): SincronizarAgentePublicoInput {
  return {
    identificador: { fonte: 'camara', codigo: String(deputado.idDeputado) },
    nome: deputado.nome,
    siglaPartido: deputado.siglaPartido === SEM_PARTIDO ? null : deputado.siglaPartido,
    urlDaFoto: deputado.urlFoto,
    // Cada período de exercício é um mandato. O que está em curso termina, no máximo, com a
    // legislatura.
    mandatos: deputado.exercicios.map((exercicio) => ({
      cargo: 'deputado_federal',
      circunscricao,
      inicio: new Date(exercicio.inicio),
      fim: exercicio.fim === null ? fimDaLegislatura(legislatura.dataFim) : new Date(exercicio.fim),
    })),
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
