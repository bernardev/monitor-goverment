import type { ConsultaDeObras, FiltroDeObras } from '@prometeu/consulta';
import type { ObraDetalhada, ObraResumo, Pagina } from '@prometeu/contracts';

// Dublê da consulta de obras para os testes do controller.

export const OBRA = '0192d5e0-7777-7000-8000-000000000001';

export const obra: ObraDetalhada = {
  obraId: OBRA,
  idNaFonte: '151020.43-16',
  nome: 'IMPLANTACAO UBS',
  situacao: 'em_execucao',
  uf: 'RS',
  municipios: [{ codigoIbge: '4320008', nome: 'Sapucaia do Sul' }],
  medicao: { percentualCentesimos: 2335, em: '2026-10-21' },
  investimentoPrevistoCentavos: '20000000',
  fonte: { capturaId: OBRA, url: 'https://obrasgov/projeto', coletadaEm: null },
  descricao: null,
  natureza: 'Obra',
  especie: 'Construção',
  situacaoNaFonte: 'Em execução',
  endereco: null,
  pontos: [],
  inicioPrevisto: null,
  fimPrevisto: null,
  inicioEfetivo: null,
  fimEfetivo: null,
  executores: [],
  interrupcoes: [],
  emendas: [],
};

export class ObrasFalsas implements ConsultaDeObras {
  ultimoFiltro: FiltroDeObras | undefined;

  listar(filtro: FiltroDeObras): Promise<Pagina<ObraResumo>> {
    this.ultimoFiltro = filtro;
    return Promise.resolve({
      itens: [obra],
      pagina: filtro.pagina,
      itensPorPagina: filtro.itensPorPagina,
      total: 1,
    });
  }

  buscar(obraId: string): Promise<ObraDetalhada | undefined> {
    return Promise.resolve(obraId === OBRA ? obra : undefined);
  }

  daEmenda(): Promise<ObraResumo[]> {
    return Promise.resolve([obra]);
  }
}
