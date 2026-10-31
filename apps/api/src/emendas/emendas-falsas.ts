import type { ConsultaDeEmendas, FiltroDeEmendas, Paginacao } from '@prometeu/consulta';
import type {
  EmendaDetalhada,
  EmendaResumo,
  EmendasDoParlamentar,
  ExecucaoDaEmenda,
  Pagina,
} from '@prometeu/contracts';

// Dublê da consulta de emendas para os testes dos controllers.

export const EMENDA = '0192d5e0-6666-7000-8000-000000000001';

const execucao: ExecucaoDaEmenda = {
  empenhadoCentavos: '100000000',
  liquidadoCentavos: '60000000',
  pagoCentavos: '50000000',
  restosInscritosCentavos: '0',
  restosCanceladosCentavos: '0',
  restosPagosCentavos: '0',
};

export const emenda: EmendaDetalhada = {
  emendaId: EMENDA,
  codigoNaFonte: '202690010001',
  ano: 2026,
  tipo: 'individual',
  numero: '0001',
  autor: { pessoaId: null, nome: 'ANA EXEMPLO' },
  ufs: ['SP'],
  localidades: ['SÃO PAULO - SP'],
  modalidades: ['finalidade_definida'],
  execucao,
  fonte: { capturaId: EMENDA, url: 'https://portal/emendas', coletadaEm: null },
  destinacoes: [],
  favorecidos: null,
  convenios: [],
};

export class EmendasFalsas implements ConsultaDeEmendas {
  ultimoFiltro: FiltroDeEmendas | undefined;
  ultimaPaginacao: Paginacao | undefined;

  listar(filtro: FiltroDeEmendas): Promise<Pagina<EmendaResumo>> {
    this.ultimoFiltro = filtro;
    return Promise.resolve({
      itens: [emenda],
      pagina: filtro.pagina,
      itensPorPagina: filtro.itensPorPagina,
      total: 1,
    });
  }

  buscar(emendaId: string): Promise<EmendaDetalhada | undefined> {
    return Promise.resolve(emendaId === EMENDA ? emenda : undefined);
  }

  doParlamentar(_pessoaId: string, paginacao: Paginacao): Promise<EmendasDoParlamentar> {
    this.ultimaPaginacao = paginacao;
    return Promise.resolve({
      itens: [emenda],
      pagina: paginacao.pagina,
      itensPorPagina: paginacao.itensPorPagina,
      total: 1,
      soma: execucao,
    });
  }
}
