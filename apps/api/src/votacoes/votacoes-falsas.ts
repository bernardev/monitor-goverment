import type { ConsultaDeVotacoes, FiltroDeVotacoes, PeriodoEmDias } from '@prometeu/consulta';
import type {
  Pagina,
  VotacaoNominalDetalhada,
  VotacaoNominalResumo,
  VotosDoParlamentar,
} from '@prometeu/contracts';

// Dublê da consulta de votações para os testes dos controllers.

export const VOTACAO = '0192d5e0-7777-7000-8000-000000000001';

export const votacao: VotacaoNominalDetalhada = {
  votacaoId: VOTACAO,
  casa: 'camara_dos_deputados',
  codigoNaFonte: '900100-10',
  dia: '2026-10-14',
  registradaEm: '2026-10-14T22:42:50.000Z',
  descricao: 'Aprovado o Projeto de Lei nº 900, de 2026.',
  resultado: 'aprovada',
  secreta: false,
  proposicoes: [],
  placar: { sim: 1, nao: 0, abstencao: 0, obstrucao: 0, presidente_da_sessao: 0, secreto: 0 },
  relacaoCompleta: false,
  contagemSemVoto: { presente_sem_voto: 0, ausente: 0, ausencia_justificada: 0, nao_informada: 0 },
  fonte: { capturaId: VOTACAO, url: 'https://camara/votacoes/1', coletadaEm: null },
  votos: [],
  semVoto: [],
  fonteDosVotos: { capturaId: VOTACAO, url: 'https://camara/votacoes/1/votos', coletadaEm: null },
};

export class VotacoesFalsas implements ConsultaDeVotacoes {
  ultimoFiltro: FiltroDeVotacoes | undefined;
  ultimoPeriodo: PeriodoEmDias | undefined;

  listar(filtro: FiltroDeVotacoes): Promise<Pagina<VotacaoNominalResumo>> {
    this.ultimoFiltro = filtro;
    return Promise.resolve({
      itens: [votacao],
      pagina: filtro.pagina,
      itensPorPagina: filtro.itensPorPagina,
      total: 1,
    });
  }

  buscar(votacaoId: string): Promise<VotacaoNominalDetalhada | undefined> {
    return Promise.resolve(votacaoId === VOTACAO ? votacao : undefined);
  }

  doParlamentar(pessoaId: string, periodo: PeriodoEmDias): Promise<VotosDoParlamentar> {
    this.ultimoPeriodo = periodo;
    return Promise.resolve({
      pessoaId,
      ...periodo,
      resumo: { votacoes: 0, comVoto: 0, semVotoRegistrado: 0, porOpcao: [] },
      participacoes: [],
    });
  }
}
