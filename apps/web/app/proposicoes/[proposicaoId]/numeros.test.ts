import { textoDaContagem } from '@prometeu/ui';
import { describe, expect, it } from 'vitest';

import { numerosDaProposicao, periodoDosAtos } from './numeros';

const atos = [
  { em: '2026-06-05T15:00:00Z' },
  { em: '2026-03-03T15:00:00Z' },
  { em: '2026-04-01T15:00:00Z' },
];

describe('periodoDosAtos', () => {
  it('vai do ato mais antigo ao mais recente, seja qual for a ordem', () => {
    expect(periodoDosAtos(atos)).toBe('de 3 de março de 2026 a 5 de junho de 2026');
  });

  it('um dia só vira "em"', () => {
    expect(periodoDosAtos([{ em: '2026-03-03T15:00:00Z' }])).toBe('em 3 de março de 2026');
  });

  it('sem ato, diz que não há', () => {
    expect(periodoDosAtos([])).toBe('nenhum ato coletado');
  });
});

describe('numerosDaProposicao', () => {
  it('conta atos e votações nominais, cada um com o seu período', () => {
    const numeros = numerosDaProposicao({
      tramitacoes: atos,
      votacoes: [{ dia: '2026-05-10' }, { dia: '2026-05-20' }],
    });
    expect(numeros.map((n) => n.valor)).toEqual(['3', '2']);
    expect(numeros.map((n) => n.rotulo)).toEqual([
      'atos de tramitação coletados',
      'votações nominais coletadas',
    ]);
    expect(numeros[0]?.periodo).toBe('de 3 de março de 2026 a 5 de junho de 2026');
    expect(numeros[1]?.periodo).toBe('de 10 de maio de 2026 a 20 de maio de 2026');
    for (const n of numeros) expect(n.valor).toBe(textoDaContagem(n.contagem!, 1));
  });

  it('um ato e uma votação ficam no singular', () => {
    const numeros = numerosDaProposicao({
      tramitacoes: [atos[0]!],
      votacoes: [{ dia: '2026-05-10' }],
    });
    expect(numeros.map((n) => n.rotulo)).toEqual([
      'ato de tramitação coletado',
      'votação nominal coletada',
    ]);
  });

  it('sem dado mostra "—", sem contagem, e mantém rótulo e período', () => {
    const numeros = numerosDaProposicao({ tramitacoes: [], votacoes: [] });
    expect(numeros.map((n) => n.valor)).toEqual(['—', '—']);
    expect(numeros.every((n) => n.contagem === undefined)).toBe(true);
    expect(numeros[1]?.periodo).toBe('nenhuma votação nominal coletada');
  });
});
