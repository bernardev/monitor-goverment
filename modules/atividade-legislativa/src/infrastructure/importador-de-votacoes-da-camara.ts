import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type { OrigemDoDado } from '../application/portas.js';
import type {
  RegistrarVotacaoNominal,
  RegistrarVotacaoNominalInput,
} from '../application/registrar-votacao-nominal.js';
import type { OpcaoDeVoto } from '../domain/voto.js';
import { camaraVotacao, camaraVotos } from './prata-da-camara.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

/** Grafias da Câmara (contrato `camara_votos`). Voto nulo é o da votação secreta. */
const OPCAO: Readonly<Record<string, OpcaoDeVoto>> = {
  Sim: 'sim',
  Não: 'nao',
  Abstenção: 'abstencao',
  Obstrução: 'obstrucao',
  'Artigo 17': 'presidente_da_sessao',
};

type Origem = Pick<
  typeof camaraVotacao.$inferSelect,
  | 'origemFonte'
  | 'origemUrl'
  | 'origemColetadaEm'
  | 'origemSha256'
  | 'origemCaminho'
  | 'origemTipoDeConteudo'
>;

/**
 * Camada anticorrupção da Câmara (ADR-0005): traduz as votações nominais da prata para a linguagem
 * deste contexto. Nenhuma grafia ou convenção da Câmara passa daqui.
 *
 * O lote é o de `camara_votacao`; os votos de cada votação estão em `camara_votos`, gravados na mesma
 * transação.
 */
export class ImportadorDeVotacoesDaCamara {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarVotacaoNominal,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select({ votacao: camaraVotacao, votos: camaraVotos })
      .from(camaraVotacao)
      .leftJoin(camaraVotos, eq(camaraVotos.idVotacao, camaraVotacao.idVotacao))
      .where(eq(camaraVotacao.loteId, loteId))
      .orderBy(camaraVotacao.registradaEm, camaraVotacao.idVotacao);

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const { votacao, votos } of linhas) {
      const codigoNaFonte = votacao.idVotacao;
      const entrada = votos === null ? undefined : paraEntrada(votacao, votos);
      if (entrada === undefined) {
        falhas.push({
          codigoNaFonte,
          erro: votos === null ? 'votacao.votos_ausentes' : 'votacao.grafia_desconhecida',
          mensagem: `Votação da prata sem tradução: ${codigoNaFonte}.`,
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
    return { loteId, importacao: 'votacoes_da_camara', lidos: linhas.length, novos, falhas };
  }
}

function paraEntrada(
  votacao: typeof camaraVotacao.$inferSelect,
  votos: typeof camaraVotos.$inferSelect,
): RegistrarVotacaoNominalInput | undefined {
  const traduzidos = votos.votos.map((voto) => ({
    parlamentar: { fonte: 'camara', codigo: String(voto.id_deputado) } as const,
    opcao: voto.voto === null ? 'secreto' : OPCAO[voto.voto],
    registroNaFonte: voto.voto,
    registradoEm: new Date(voto.registrado_em),
    siglaPartidoNaFonte: voto.sigla_partido,
  }));
  if (traduzidos.some((v) => v.opcao === undefined)) return undefined;
  return {
    casa: 'camara_dos_deputados',
    codigoNaFonte: votacao.idVotacao,
    dia: votacao.data,
    registradaEm: votacao.registradaEm,
    descricao: votacao.descricao,
    resultado:
      votacao.aprovacao === null ? 'nao_informado' : votacao.aprovacao ? 'aprovada' : 'rejeitada',
    proposicoes: votacao.proposicoes.map((p) => ({
      codigoNaFonte: String(p.id),
      sigla: p.sigla_tipo,
      numero: p.numero,
      ano: p.ano,
      ementa: p.ementa,
    })),
    votos: traduzidos.flatMap(({ opcao, ...voto }) => (opcao ? [{ ...voto, opcao }] : [])),
    // A Câmara só lista quem votou: quem não aparece não é ausente, a fonte só não diz.
    relacaoCompleta: false,
    semVoto: [],
    origem: origem(votacao),
    origemDosVotos: origem(votos),
  };
}

function origem(linha: Origem): OrigemDoDado {
  return {
    fonte: linha.origemFonte,
    url: linha.origemUrl,
    coletadaEm: linha.origemColetadaEm,
    sha256: linha.origemSha256,
    caminho: linha.origemCaminho,
    tipoDeConteudo: linha.origemTipoDeConteudo,
  };
}
