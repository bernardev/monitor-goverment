import { describe, expect, it } from 'vitest';

import { violacoesDoContrato } from './esquemas.js';

describe('violacoesDoContrato', () => {
  it('aceita dados que respeitam o esquema', () => {
    expect(
      violacoesDoContrato('FiliacaoPartidariaAlterada', 1, {
        de: 'PEX',
        para: null,
        capturaId: '0192d5e0-1111-7000-8000-000000000001',
      }),
    ).toEqual([]);
  });

  it('aponta campo faltando, campo a mais e formato errado', () => {
    const violacoes = violacoesDoContrato('FiliacaoPartidariaAlterada', 1, {
      de: 'PEX',
      capturaId: 'não é uuid',
      extra: true,
    });
    expect(violacoes).toHaveLength(3);
  });

  it('o LoteIngerido gravado pela plataforma de dados respeita o contrato', () => {
    expect(
      violacoesDoContrato('LoteIngerido', 1, {
        fonte: 'camara',
        tabela: 'camara_deputado',
        versaoDoContrato: '1.0.0',
        coletadoDe: '2026-10-30T09:00:00+00:00',
        coletadoAte: '2026-10-30T09:00:00+00:00',
        registros: 513,
      }),
    ).toEqual([]);
  });
});
