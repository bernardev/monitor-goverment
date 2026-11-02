import { describe, expect, it } from 'vitest';

import { ORDEM_DAS_OPCOES, partesDoPlacar, placarEmFrase, TOM_DA_OPCAO } from './placar';

const placar = {
  sim: 382,
  nao: 118,
  abstencao: 3,
  obstrucao: 1,
  presidente_da_sessao: 0,
  secreto: 0,
};

describe('placar', () => {
  it('escreve cada contagem no singular ou no plural', () => {
    expect(placarEmFrase({ placar })).toBe('382 sim, 118 não, 3 abstenções, 1 obstrução');
    expect(placarEmFrase({ placar: { ...placar, abstencao: 1, obstrucao: 2 } })).toBe(
      '382 sim, 118 não, 1 abstenção, 2 obstruções',
    );
  });

  it('a legenda de cada parte traz a contagem escrita', () => {
    expect(partesDoPlacar({ placar }).map((p) => p.texto)).toEqual([
      '382 sim',
      '118 não',
      '3 abstenções',
      '1 obstrução',
    ]);
  });

  it('sim é o tom forte e não o médio; nunca vermelho e verde, só tons', () => {
    expect(TOM_DA_OPCAO.sim).toBe('forte');
    expect(TOM_DA_OPCAO.nao).toBe('medio');
    for (const o of ORDEM_DAS_OPCOES.slice(2))
      expect(['fraco', 'vazio']).toContain(TOM_DA_OPCAO[o]);
  });

  it('a ordem é sim, não e depois as demais', () => {
    expect(ORDEM_DAS_OPCOES.slice(0, 2)).toEqual(['sim', 'nao']);
  });
});
