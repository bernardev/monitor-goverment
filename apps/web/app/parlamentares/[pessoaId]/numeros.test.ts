import type { EmendasDoParlamentar, FrequenciaDoParlamentar } from '@prometeu/contracts';
import { describe, expect, it } from 'vitest';

import { numerosDoParlamentar } from './numeros';

const fonte = {
  capturaId: 'c1',
  url: 'https://exemplo.gov.br/x',
  coletadaEm: '2026-10-30T19:46:00Z',
};

const frequencia: FrequenciaDoParlamentar = {
  pessoaId: 'p1',
  de: '2026-08-04',
  ate: '2026-11-01',
  resumo: {
    diasComSessao: 12,
    presencas: 5,
    ausenciasJustificadas: 6,
    ausenciasSemJustificativa: 1,
    porMotivo: [],
  },
  dias: [],
};

const emendas: EmendasDoParlamentar = {
  itens: [
    {
      emendaId: 'e1',
      codigoNaFonte: '1',
      ano: 2026,
      tipo: 'individual',
      numero: '0001',
      autor: { pessoaId: 'p1', nome: 'Fulana' },
      ufs: [],
      localidades: [],
      modalidades: [],
      execucao: {
        empenhadoCentavos: '10890000000',
        liquidadoCentavos: '0',
        pagoCentavos: '8860000000',
        restosInscritosCentavos: '0',
        restosCanceladosCentavos: '0',
        restosPagosCentavos: '0',
      },
      fonte,
    },
  ],
  pagina: 1,
  itensPorPagina: 20,
  total: 37,
  soma: {
    empenhadoCentavos: '10890000000',
    liquidadoCentavos: '0',
    pagoCentavos: '8860000000',
    restosInscritosCentavos: '0',
    restosCanceladosCentavos: '0',
    restosPagosCentavos: '0',
  },
};

const dadosDeExemplo = { frequencia, emendas };

describe('numerosDoParlamentar', () => {
  it('sem frequência e sem emendas, a faixa mostra traço, sem contagem', () => {
    const itens = numerosDoParlamentar({});
    expect(itens.every((n) => n.valor === '—' && n.contagem === undefined)).toBe(true);
    expect(itens.every((n) => n.periodo.length > 0)).toBe(true);
  });

  it('com dados, os quatro números da referência', () => {
    expect(numerosDoParlamentar(dadosDeExemplo).map((n) => n.valor)).toEqual([
      '5 de 12',
      '6',
      '37',
      '81%',
    ]);
  });

  it('rótulos e períodos de quem lê: o que é, de quando é', () => {
    const itens = numerosDoParlamentar(dadosDeExemplo);
    expect(itens.map((n) => n.rotulo)).toEqual([
      'dias de sessão em que esteve presente',
      'faltas justificadas (e 1 sem justificativa)',
      'emendas indicadas, R$ 108,9 milhões',
      'do valor das emendas já pago',
    ]);
    expect(itens.map((n) => n.periodo)).toEqual([
      'ago. a nov. de 2026',
      'ago. a nov. de 2026',
      'desde o orçamento de 2023, até a coleta de 30/10/2026',
      'desde o orçamento de 2023, até a coleta de 30/10/2026',
    ]);
  });

  it('a contagem termina no mesmo texto que o servidor entrega', () => {
    const [presenca, , , pago] = numerosDoParlamentar(dadosDeExemplo);
    expect(presenca?.contagem).toEqual({ alvo: 5, sufixo: ' de 12' });
    expect(pago?.contagem).toEqual({ alvo: 81, sufixo: '%' });
  });

  it('emenda sem empenho não inventa percentual', () => {
    const zerada = { ...emendas, soma: { ...emendas.soma, empenhadoCentavos: '0' } };
    expect(numerosDoParlamentar({ emendas: zerada })[3]?.valor).toBe('—');
  });

  it('frequência sem dia de sessão não vira zero de presença', () => {
    const vazia = { ...frequencia, resumo: { ...frequencia.resumo, diasComSessao: 0 } };
    expect(numerosDoParlamentar({ frequencia: vazia })[0]?.valor).toBe('—');
  });
});
