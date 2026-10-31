import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq, inArray } from 'drizzle-orm';

import type { RegistrarObra, RegistrarObraInput } from '../application/registrar-obra.js';
import type { Interrupcao, SituacaoDaObra } from '../domain/situacao-da-obra.js';
import {
  obrasgovEmpenhoDeEmenda as empenhos,
  obrasgovExecucaoFisica as execucoes,
  obrasgovLocalizacao as localizacoes,
  obrasgovProjeto as projetos,
  obrasgovSituacao as historico,
} from './prata-do-obrasgov.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

/** Grafias do Obrasgov.br (contrato `obrasgov_projeto`). */
const SITUACAO: Readonly<Record<string, SituacaoDaObra>> = {
  Cadastrada: 'planejada',
  'Em execução': 'em_execucao',
  Paralisada: 'paralisada',
  Concluída: 'concluida',
  Cancelada: 'cancelada',
  Inacabada: 'inacabada',
};

/** Grafias do histórico (contrato `obrasgov_situacao`). */
const INTERRUPCAO: Readonly<Record<string, Interrupcao>> = {
  Paralisada: 'paralisada',
  Cancelada: 'cancelada',
  Inacabada: 'inacabada',
};

/** Obras lidas da prata por vez. */
const OBRAS_POR_VEZ = 500;

type Projeto = typeof projetos.$inferSelect;
type Partes = {
  readonly empenhos: (typeof empenhos.$inferSelect)[];
  readonly execucoes: (typeof execucoes.$inferSelect)[];
  readonly historico: (typeof historico.$inferSelect)[];
  readonly localizacoes: (typeof localizacoes.$inferSelect)[];
};

/**
 * Camada anticorrupção do Obrasgov.br (ADR-0005). O lote de projetos traz as obras ligadas a emendas;
 * empenhos, execução física, histórico e localização são lidos por obra, das linhas mais recentes de
 * cada tabela (a coleta grava todas numa só transação, antes de anunciar os lotes). Uma linha que a
 * fonte deixou de publicar continua na prata e na obra.
 */
export class ImportadorDeObrasDoObrasGov {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarObra,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const doLote = await this.banco.executor
      .select()
      .from(projetos)
      .where(eq(projetos.loteId, loteId))
      .orderBy(projetos.idProjeto);

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (let inicio = 0; inicio < doLote.length; inicio += OBRAS_POR_VEZ) {
      const parte = doLote.slice(inicio, inicio + OBRAS_POR_VEZ);
      const partes = await this.partes(parte.map((p) => p.idProjeto));
      for (const projeto of parte) {
        const daObra = <T extends { idProjeto: string }>(linhas: readonly T[]) =>
          linhas.filter((l) => l.idProjeto === projeto.idProjeto);
        const entrada = paraEntrada(projeto, {
          empenhos: daObra(partes.empenhos),
          execucoes: daObra(partes.execucoes),
          historico: daObra(partes.historico),
          localizacoes: daObra(partes.localizacoes),
        });
        if (typeof entrada === 'string') {
          falhas.push({
            codigoNaFonte: projeto.idProjeto,
            erro: 'obra.situacao_desconhecida',
            mensagem: `Situação "${entrada}" fora do contrato na obra ${projeto.idProjeto}.`,
          });
          continue;
        }
        const resultado = await this.registrar.execute(entrada);
        if (resultado.ok) {
          if (resultado.value.nova) novos += 1;
        } else {
          falhas.push({
            codigoNaFonte: projeto.idProjeto,
            erro: resultado.error.code,
            mensagem: resultado.error.message,
          });
        }
      }
    }
    return { loteId, lidos: doLote.length, novos, falhas };
  }

  private async partes(ids: string[]): Promise<Partes> {
    const [e, x, h, l] = await Promise.all([
      this.banco.executor.select().from(empenhos).where(inArray(empenhos.idProjeto, ids)),
      this.banco.executor.select().from(execucoes).where(inArray(execucoes.idProjeto, ids)),
      this.banco.executor.select().from(historico).where(inArray(historico.idProjeto, ids)),
      this.banco.executor.select().from(localizacoes).where(inArray(localizacoes.idProjeto, ids)),
    ]);
    return { empenhos: e, execucoes: x, historico: h, localizacoes: l };
  }
}

/** A entrada do caso de uso, ou a grafia da situação que o contrato não conhece. */
function paraEntrada(projeto: Projeto, partes: Partes): RegistrarObraInput | string {
  const situacao = SITUACAO[projeto.situacao];
  if (situacao === undefined) return projeto.situacao;
  // A fonte repete o mesmo registro (mesmo dia, situação e justificativa) dezenas de vezes, com
  // identificadores diferentes: fica um só.
  const interrupcoes = new Map<
    string,
    { tipo: Interrupcao; em: string; justificativa: string | null }
  >();
  for (const h of partes.historico) {
    const tipo = INTERRUPCAO[h.situacao];
    if (tipo === undefined) return h.situacao;
    interrupcoes.set(JSON.stringify([tipo, h.em, h.justificativa]), {
      tipo,
      em: h.em,
      justificativa: h.justificativa,
    });
  }
  const municipios = new Map<string, string | null>();
  for (const l of partes.localizacoes) {
    if (l.codigoMunicipioIbge !== null) municipios.set(l.codigoMunicipioIbge, l.municipio);
  }
  return {
    idNaFonte: projeto.idProjeto,
    apuracao: {
      nome: projeto.nome,
      descricao: projeto.descricao,
      natureza: projeto.natureza,
      especie: projeto.especie,
      situacao,
      situacaoNaFonte: projeto.situacao,
      uf: projeto.uf,
      municipios: [...municipios].map(([codigoIbge, nome]) => ({ codigoIbge, nome })),
      pontos: projeto.localizacoes,
      endereco: projeto.endereco,
      inicioPrevisto: projeto.inicioPrevisto,
      fimPrevisto: projeto.fimPrevisto,
      inicioEfetivo: projeto.inicioEfetivo,
      fimEfetivo: projeto.fimEfetivo,
      // Todas as fontes de recurso: a federal e a contrapartida, quando a fonte a informa.
      investimentoPrevisto: projeto.investimentosPrevistos.reduce(
        (soma, i) => soma + BigInt(i.valor_centavos),
        0n,
      ),
      executores: projeto.executores,
      medicao: medicaoMaisRecente(partes.execucoes),
      interrupcoes: [...interrupcoes.values()],
      emendas: partes.empenhos.map((e) => ({
        codigoDaEmenda: e.codigoEmenda,
        ugEmitente: e.ugEmitente,
        numeroDoEmpenho: e.numeroEmpenho,
        acaoOrcamentaria: e.acaoOrcamentaria,
        empenhado: e.valorEmpenhadoCentavos,
        emitidoEm: e.emitidoEm,
      })),
    },
    origem: {
      fonte: projeto.origemFonte,
      url: projeto.origemUrl,
      coletadaEm: projeto.origemColetadaEm,
      sha256: projeto.origemSha256,
      caminho: projeto.origemCaminho,
      tipoDeConteudo: projeto.origemTipoDeConteudo,
    },
  };
}

/** A execução atualizada por último que traz percentual; a fonte pode ter mais de uma por obra. */
function medicaoMaisRecente(linhas: Partes['execucoes']) {
  const comPercentual = linhas.filter((l) => l.percentualCentesimos !== null);
  const [ultima] = comPercentual.sort((a, b) => {
    const x = a.atualizadaEm ?? a.cadastradaEm ?? '';
    const y = b.atualizadaEm ?? b.cadastradaEm ?? '';
    return x === y ? b.idExecucao - a.idExecucao : x < y ? 1 : -1;
  });
  if (ultima?.percentualCentesimos == null) return null;
  return {
    percentualCentesimos: ultima.percentualCentesimos,
    em: ultima.atualizadaEm ?? ultima.cadastradaEm,
  };
}
