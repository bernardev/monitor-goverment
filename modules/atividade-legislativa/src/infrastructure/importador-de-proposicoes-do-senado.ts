import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type {
  RegistrarProposicao,
  RegistrarProposicaoInput,
} from '../application/registrar-proposicao.js';
import { TIPOS_DE_PROPOSICAO } from '../domain/tipo-de-proposicao.js';
import { senadoProcesso } from './prata-do-senado.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';
import { inicioDoDia, primeiraVez } from './traducao.js';

/**
 * Camada anticorrupção do Senado (ADR-0005): traduz os processos da prata para a linguagem deste
 * contexto. O histórico de situações do processo é a tramitação: cada situação, no dia em que
 * começou e no colegiado onde estava.
 *
 * As datas do Senado são dias, sem hora: viram o primeiro instante do dia em Brasília.
 */
export class ImportadorDeProposicoesDoSenado {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarProposicao,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select()
      .from(senadoProcesso)
      .where(eq(senadoProcesso.loteId, loteId))
      .orderBy(senadoProcesso.idProcesso);

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const processo of linhas) {
      const codigoNaFonte = String(processo.idProcesso);
      const entrada = paraEntrada(processo);
      if (entrada === undefined) {
        falhas.push({
          codigoNaFonte,
          erro: 'proposicao.tipo_desconhecido',
          mensagem: `Processo da prata sem tradução: ${codigoNaFonte}.`,
        });
        continue;
      }
      const resultado = await this.registrar.execute(entrada);
      if (resultado.ok) {
        if (resultado.value.nova) novos += 1;
      } else {
        falhas.push({
          codigoNaFonte,
          erro: resultado.error.code,
          mensagem: resultado.error.message,
        });
      }
    }
    return { loteId, importacao: 'proposicoes_do_senado', lidos: linhas.length, novos, falhas };
  }
}

function paraEntrada(
  processo: typeof senadoProcesso.$inferSelect,
): RegistrarProposicaoInput | undefined {
  const sigla = TIPOS_DE_PROPOSICAO.find((t) => t === processo.sigla);
  if (sigla === undefined) return undefined;
  const atual = processo.situacoes.at(-1);
  const vistos = new Set<number>();
  return {
    casa: 'senado_federal',
    codigoNaFonte: String(processo.idProcesso),
    sigla,
    numero: processo.numero,
    ano: processo.ano,
    ementa: processo.ementa,
    apresentadaEm: processo.apresentadaEm === null ? null : inicioDoDia(processo.apresentadaEm),
    autores: processo.autores
      .filter((a) => a.codigo_parlamentar === null || primeiraVez(vistos, a.codigo_parlamentar))
      .map((a) => ({
        // O Senado só identifica senadores pelo código; deputados e órgãos ficam com o nome.
        parlamentar:
          a.codigo_parlamentar === null
            ? null
            : { fonte: 'senado', codigo: String(a.codigo_parlamentar) },
        nomeNaFonte: a.nome,
        tipoNaFonte: a.tipo,
        proponente: true,
      })),
    situacao: processo.situacao
      ? {
          descricao: processo.situacao.descricao,
          desde: inicioDoDia(processo.situacao.desde),
          orgao: atual?.sigla === processo.situacao.sigla ? atual.colegiado : null,
        }
      : null,
    tramitacoes: processo.situacoes.map((s) => ({
      em: inicioDoDia(s.inicio),
      orgao: s.colegiado,
      descricao: s.descricao,
      situacao: s.descricao,
      despacho: null,
    })),
    normaGerada: processo.normaGerada,
    urlDoTexto: processo.urlDocumento,
    origem: {
      fonte: processo.origemFonte,
      url: processo.origemUrl,
      coletadaEm: processo.origemColetadaEm,
      sha256: processo.origemSha256,
      caminho: processo.origemCaminho,
      tipoDeConteudo: processo.origemTipoDeConteudo,
    },
  };
}
