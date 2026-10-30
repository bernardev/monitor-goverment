import { describe, expect, it } from 'vitest';

import { pessoaPeloNome } from './nome-na-fonte.js';

const candidatos = [
  { pessoaId: 'a', nome: 'Acácio Favacho' },
  { pessoaId: 'b', nome: 'Sargento Gonçalves' },
  { pessoaId: 'c', nome: 'Ana Exemplo' },
  { pessoaId: 'd', nome: 'Ana  Exemplo' },
];

describe('pessoaPeloNome', () => {
  it('compara sem acento, caixa e espaços', () => {
    expect(pessoaPeloNome('ACACIO FAVACHO', candidatos)).toBe('a');
    expect(pessoaPeloNome('sargento goncalves', candidatos)).toBe('b');
  });

  it('homônimo ou nome desconhecido não identifica ninguém', () => {
    expect(pessoaPeloNome('ANA EXEMPLO', candidatos)).toBeUndefined();
    expect(pessoaPeloNome('BANCADA DA BAHIA', candidatos)).toBeUndefined();
    expect(pessoaPeloNome('  ', candidatos)).toBeUndefined();
  });

  it('a mesma pessoa repetida entre os candidatos continua identificada', () => {
    expect(pessoaPeloNome('ACACIO FAVACHO', [...candidatos, candidatos[0]!])).toBe('a');
  });
});
