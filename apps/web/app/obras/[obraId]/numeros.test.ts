import { textoDaContagem } from '@prometeu/ui';
import { describe, expect, it } from 'vitest';

import { nomeCabeNoTitulo, numerosDaObra, periodoAteAColeta } from './numeros';

const base = {
  medicao: { percentualCentesimos: 2335, em: '2026-10-21' },
  investimentoPrevistoCentavos: '250000000',
  emendas: [{ empenhadoCentavos: '100000000' }, { empenhadoCentavos: '50000000' }],
  coletadaEm: '2026-10-30T19:46:00Z',
};

describe('nomeCabeNoTitulo', () => {
  it('nome curto cabe em duas linhas de título no telefone', () => {
    expect(nomeCabeNoTitulo('Escola Municipal Nova')).toBe(true);
  });

  it('nome comprido não cabe', () => {
    expect(
      nomeCabeNoTitulo('Pavimentação Asfáltica de Estrada Vicinal no Município de Rio Branco'),
    ).toBe(false);
  });

  it('caixa alta pesa mais: ocupa mais largura que o mesmo texto em caixa baixa', () => {
    expect(nomeCabeNoTitulo('TRATAMENTO SUPERFICIAL DUPLO - TSD')).toBe(false);
    expect(nomeCabeNoTitulo('Tratamento superficial duplo')).toBe(true);
  });
});

describe('periodoAteAColeta', () => {
  it('diz até quando vai a coleta', () => {
    expect(periodoAteAColeta('2026-10-30T19:46:00Z')).toBe('até a coleta de 30/10/2026');
  });

  it('sem data de coleta, não inventa uma', () => {
    expect(periodoAteAColeta(null)).toBe('data da coleta não informada');
  });
});

describe('numerosDaObra', () => {
  it('traz o executado, o investimento previsto e o que as emendas reservaram', () => {
    const numeros = numerosDaObra(base);
    expect(numeros.map((n) => n.valor)).toEqual(['23,35%', 'R$ 2,5 milhões', 'R$ 1,5 milhão']);
    expect(numeros.map((n) => n.rotulo)).toEqual([
      'da obra executados, segundo o Obrasgov.br',
      'de investimento previsto',
      'empenhados (reservados no orçamento) por 2 emendas',
    ]);
    expect(numeros[0]?.periodo).toBe('medição de 21 de outubro de 2026');
    expect(numeros[1]?.periodo).toBe('previsto no cadastro, coletado em 30/10/2026');
    expect(numeros[2]?.periodo).toBe('desde o orçamento de 2023, até a coleta de 30/10/2026');
    expect(numeros[0]?.valor).toBe(textoDaContagem(numeros[0]!.contagem!, 1));
  });

  it('sem medição, "—" com rótulo e período, sem contagem', () => {
    const [executado] = numerosDaObra({ ...base, medicao: null });
    expect(executado?.valor).toBe('—');
    expect(executado?.contagem).toBeUndefined();
    expect(executado?.periodo).toBe('sem medição registrada');
  });

  it('medição sem data não mostra "Invalid Date"', () => {
    const [executado] = numerosDaObra({
      ...base,
      medicao: { percentualCentesimos: 500, em: null },
    });
    expect(executado?.valor).toBe('5,00%');
    expect(executado?.periodo).toBe('medição sem data informada');
  });

  it('sem emendas, a terceira fica em "—"; com uma, o rótulo usa o singular', () => {
    expect(numerosDaObra({ ...base, emendas: [] })[2]?.valor).toBe('—');
    expect(numerosDaObra({ ...base, emendas: [{ empenhadoCentavos: '100' }] })[2]?.rotulo).toBe(
      'empenhados (reservados no orçamento) por 1 emenda',
    );
  });
});
