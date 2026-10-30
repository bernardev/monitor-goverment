import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type { OrigemDoDado } from '../application/portas.js';
import type {
  RegistrarVotacaoNominal,
  RegistrarVotacaoNominalInput,
} from '../application/registrar-votacao-nominal.js';
import type { CategoriaDoMotivo } from '../domain/motivo-da-ausencia.js';
import type { OpcaoDeVoto, SituacaoSemVoto } from '../domain/voto.js';
import { type SenadorNaVotacao, senadoVotacao } from './prata-do-senado.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

/** Siglas do Senado que são voto (contrato `senado_votacao`). `Votou` é o voto secreto. */
const VOTOS: Readonly<Record<string, OpcaoDeVoto>> = {
  Sim: 'sim',
  Não: 'nao',
  Abstenção: 'abstencao',
  Votou: 'secreto',
  'Presidente (art. 51 RISF)': 'presidente_da_sessao',
};

/** Siglas de quem não votou, com o motivo quando o Senado aceita a ausência (RISF, art. 13). */
const SEM_VOTO: Readonly<
  Record<string, { situacao: SituacaoSemVoto; motivo?: CategoriaDoMotivo }>
> = {
  'P-NRV': { situacao: 'presente_sem_voto' },
  NCom: { situacao: 'ausente' },
  AP: { situacao: 'ausencia_justificada', motivo: 'atividade_parlamentar' },
  LS: { situacao: 'ausencia_justificada', motivo: 'licenca_saude' },
  MIS: { situacao: 'ausencia_justificada', motivo: 'missao_autorizada' },
  LP: { situacao: 'ausencia_justificada', motivo: 'licenca_particular' },
  LAP: { situacao: 'ausencia_justificada', motivo: 'licenca_paternidade' },
  NA: { situacao: 'nao_informada' },
};

/**
 * Camada anticorrupção do Senado (ADR-0005): traduz as votações nominais da prata para a linguagem
 * deste contexto. O Senado lista todos os senadores em exercício em cada votação, então a votação
 * chega com a relação completa: quem votou e quem não votou, com o motivo.
 *
 * A fonte não informa o horário da votação nem do voto: o mandato é o exercido no dia.
 */
export class ImportadorDeVotacoesDoSenado {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarVotacaoNominal,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select()
      .from(senadoVotacao)
      .where(eq(senadoVotacao.loteId, loteId))
      .orderBy(senadoVotacao.data, senadoVotacao.codigoSessaoVotacao);

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const votacao of linhas) {
      const codigoNaFonte = String(votacao.codigoSessaoVotacao);
      const entrada = paraEntrada(votacao);
      if (entrada === undefined) {
        falhas.push({
          codigoNaFonte,
          erro: 'votacao.grafia_desconhecida',
          mensagem: `Votação da prata com sigla sem tradução: ${codigoNaFonte}.`,
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
    return { loteId, importacao: 'votacoes_do_senado', lidos: linhas.length, novos, falhas };
  }
}

function paraEntrada(
  votacao: typeof senadoVotacao.$inferSelect,
): RegistrarVotacaoNominalInput | undefined {
  const votos: RegistrarVotacaoNominalInput['votos'][number][] = [];
  const semVoto: RegistrarVotacaoNominalInput['semVoto'][number][] = [];
  for (const senador of votacao.votos) {
    const parlamentar = { fonte: 'senado', codigo: String(senador.codigo_parlamentar) } as const;
    const opcao = VOTOS[senador.sigla_voto];
    const situacao = SEM_VOTO[senador.sigla_voto];
    if (opcao !== undefined) {
      votos.push({
        parlamentar,
        opcao,
        registroNaFonte: senador.sigla_voto,
        registradoEm: null,
        siglaPartidoNaFonte: senador.sigla_partido,
      });
    } else if (situacao !== undefined) {
      semVoto.push({
        parlamentar,
        situacao: situacao.situacao,
        motivo:
          situacao.motivo === undefined
            ? null
            : { categoria: situacao.motivo, descricaoNaFonte: descricao(senador) },
        registroNaFonte: senador.sigla_voto,
        siglaPartidoNaFonte: senador.sigla_partido,
      });
    } else {
      return undefined;
    }
  }
  return {
    casa: 'senado_federal',
    codigoNaFonte: String(votacao.codigoSessaoVotacao),
    dia: votacao.data,
    registradaEm: null,
    descricao: votacao.descricao,
    resultado:
      votacao.aprovada === null ? 'nao_informado' : votacao.aprovada ? 'aprovada' : 'rejeitada',
    proposicoes: proposicoes(votacao),
    votos,
    relacaoCompleta: true,
    semVoto,
    // Uma resposta traz a votação e os votos: a mesma captura prova os dois.
    origem: origem(votacao),
    origemDosVotos: origem(votacao),
  };
}

function descricao(senador: SenadorNaVotacao): string {
  return senador.descricao_voto ?? senador.sigla_voto;
}

/**
 * A matéria votada, identificada pelo id do processo: o mesmo código das proposições do Senado. Sem
 * ele (prata anterior ao contrato v1.1.0), a votação fica sem proposição ligada.
 */
function proposicoes(
  votacao: typeof senadoVotacao.$inferSelect,
): RegistrarVotacaoNominalInput['proposicoes'] {
  const numero = Number.parseInt(votacao.numeroMateria ?? '', 10);
  if (
    votacao.idProcesso === null ||
    votacao.siglaMateria === null ||
    votacao.anoMateria === null ||
    Number.isNaN(numero)
  ) {
    return [];
  }
  return [
    {
      codigoNaFonte: String(votacao.idProcesso),
      sigla: votacao.siglaMateria,
      numero,
      ano: votacao.anoMateria,
      ementa: votacao.ementa,
    },
  ];
}

function origem(linha: typeof senadoVotacao.$inferSelect): OrigemDoDado {
  return {
    fonte: linha.origemFonte,
    url: linha.origemUrl,
    coletadaEm: linha.origemColetadaEm,
    sha256: linha.origemSha256,
    caminho: linha.origemCaminho,
    tipoDeConteudo: linha.origemTipoDeConteudo,
  };
}
