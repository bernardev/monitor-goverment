import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type {
  RegistrarProposicao,
  RegistrarProposicaoInput,
} from '../application/registrar-proposicao.js';
import { TIPOS_DE_PROPOSICAO, type Tramitacao } from '../domain/proposicao.js';
import {
  camaraProposicao,
  camaraProposicaoAutores,
  camaraProposicaoTramitacoes,
  type TramitacaoNaCamara,
} from './prata-da-camara.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';
import { primeiraVez } from './traducao.js';

/**
 * Camada anticorrupção da Câmara (ADR-0005): traduz as proposições da prata para a linguagem deste
 * contexto. O lote é o de `camara_proposicao`; autores e tramitações estão nas tabelas irmãs,
 * gravadas na mesma transação.
 */
export class ImportadorDeProposicoesDaCamara {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarProposicao,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select({
        proposicao: camaraProposicao,
        autores: camaraProposicaoAutores.autores,
        tramitacoes: camaraProposicaoTramitacoes.tramitacoes,
      })
      .from(camaraProposicao)
      .leftJoin(
        camaraProposicaoAutores,
        eq(camaraProposicaoAutores.idProposicao, camaraProposicao.idProposicao),
      )
      .leftJoin(
        camaraProposicaoTramitacoes,
        eq(camaraProposicaoTramitacoes.idProposicao, camaraProposicao.idProposicao),
      )
      .where(eq(camaraProposicao.loteId, loteId))
      .orderBy(camaraProposicao.idProposicao);

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const { proposicao, autores, tramitacoes } of linhas) {
      const codigoNaFonte = String(proposicao.idProposicao);
      const entrada =
        autores === null || tramitacoes === null
          ? undefined
          : paraEntrada(proposicao, autores, tramitacoes);
      if (entrada === undefined) {
        falhas.push({
          codigoNaFonte,
          erro:
            autores === null || tramitacoes === null
              ? 'proposicao.dados_incompletos'
              : 'proposicao.tipo_desconhecido',
          mensagem: `Proposição da prata sem tradução: ${codigoNaFonte}.`,
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
    return { loteId, importacao: 'proposicoes_da_camara', lidos: linhas.length, novos, falhas };
  }
}

function paraEntrada(
  proposicao: typeof camaraProposicao.$inferSelect,
  autores: typeof camaraProposicaoAutores.$inferSelect.autores,
  tramitacoes: readonly TramitacaoNaCamara[],
): RegistrarProposicaoInput | undefined {
  const sigla = TIPOS_DE_PROPOSICAO.find((t) => t === proposicao.siglaTipo);
  if (sigla === undefined) return undefined;
  const situacao = proposicao.situacao;
  const descricaoDaSituacao = situacao?.descricao_situacao ?? situacao?.descricao_tramitacao;
  const vistos = new Set<number>();
  return {
    casa: 'camara_dos_deputados',
    codigoNaFonte: String(proposicao.idProposicao),
    sigla,
    numero: proposicao.numero,
    ano: proposicao.ano,
    ementa: proposicao.ementa,
    apresentadaEm: proposicao.apresentadaEm,
    // Um deputado aparece uma vez só na autoria, mesmo que a fonte o repita.
    autores: autores
      .filter((a) => a.id_deputado === null || primeiraVez(vistos, a.id_deputado))
      .map((a) => ({
        parlamentar:
          a.id_deputado === null ? null : { fonte: 'camara', codigo: String(a.id_deputado) },
        nomeNaFonte: a.nome,
        tipoNaFonte: a.tipo,
        proponente: a.proponente,
      })),
    situacao:
      situacao && descricaoDaSituacao
        ? {
            descricao: descricaoDaSituacao,
            desde: new Date(situacao.data_hora),
            orgao: situacao.sigla_orgao,
          }
        : null,
    tramitacoes: emOrdemCronologica(tramitacoes.map(paraTramitacao)),
    normaGerada: null,
    urlDoTexto: proposicao.urlInteiroTeor,
    origem: {
      fonte: proposicao.origemFonte,
      url: proposicao.origemUrl,
      coletadaEm: proposicao.origemColetadaEm,
      sha256: proposicao.origemSha256,
      caminho: proposicao.origemCaminho,
      tipoDeConteudo: proposicao.origemTipoDeConteudo,
    },
  };
}

/** A descrição do ato; sem ela, o despacho ou a situação, que dizem o que aconteceu. */
function paraTramitacao(t: TramitacaoNaCamara): Tramitacao {
  return {
    em: new Date(t.data_hora),
    orgao: t.sigla_orgao,
    descricao:
      t.descricao_tramitacao ?? t.despacho ?? t.descricao_situacao ?? 'Ato sem descrição na fonte',
    situacao: t.descricao_situacao,
    despacho: t.despacho,
  };
}

/**
 * A Câmara ordena pela sequência, que às vezes não acompanha a data. A ordem cronológica é estável:
 * entre atos no mesmo instante, vale a ordem da fonte.
 */
function emOrdemCronologica(tramitacoes: Tramitacao[]): Tramitacao[] {
  return tramitacoes
    .map((t, i) => [t, i] as const)
    .sort(([a, i], [b, j]) => a.em.getTime() - b.em.getTime() || i - j)
    .map(([t]) => t);
}
