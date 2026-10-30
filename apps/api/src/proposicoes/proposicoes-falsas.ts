import type { ConsultaDeProposicoes, FiltroDeProposicoes, Paginacao } from '@prometeu/consulta';
import type {
  AutoriaDoParlamentar,
  Pagina,
  ProposicaoDetalhada,
  ProposicaoResumo,
} from '@prometeu/contracts';

// Dublê da consulta de proposições para os testes dos controllers.

export const PROPOSICAO = '0192d5e0-8888-7000-8000-000000000001';

export const proposicao: ProposicaoDetalhada = {
  proposicaoId: PROPOSICAO,
  casa: 'camara_dos_deputados',
  codigoNaFonte: '900301',
  sigla: 'PL',
  numero: 901,
  ano: 2026,
  ementa: 'Tema fictício.',
  apresentadaEm: '2026-03-02T13:00:00.000Z',
  situacao: null,
  ultimaTramitacaoEm: null,
  normaGerada: null,
  fonte: { capturaId: PROPOSICAO, url: 'https://camara/proposicoes/1', coletadaEm: null },
  autores: [],
  tramitacoes: [],
  urlDoTexto: null,
  votacoes: [],
};

export class ProposicoesFalsas implements ConsultaDeProposicoes {
  ultimoFiltro: FiltroDeProposicoes | undefined;
  ultimaPaginacao: Paginacao | undefined;

  listar(filtro: FiltroDeProposicoes): Promise<Pagina<ProposicaoResumo>> {
    this.ultimoFiltro = filtro;
    return Promise.resolve({
      itens: [proposicao],
      pagina: filtro.pagina,
      itensPorPagina: filtro.itensPorPagina,
      total: 1,
    });
  }

  buscar(proposicaoId: string): Promise<ProposicaoDetalhada | undefined> {
    return Promise.resolve(proposicaoId === PROPOSICAO ? proposicao : undefined);
  }

  doParlamentar(_pessoaId: string, paginacao: Paginacao): Promise<Pagina<AutoriaDoParlamentar>> {
    this.ultimaPaginacao = paginacao;
    return Promise.resolve({
      itens: [{ proposicao, proponente: true }],
      pagina: paginacao.pagina,
      itensPorPagina: paginacao.itensPorPagina,
      total: 1,
    });
  }
}
