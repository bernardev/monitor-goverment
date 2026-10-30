import { describe, expect, it } from 'vitest';

import { Periodo } from './periodo.js';
import { Result } from './result.js';

const posse = new Date('2027-01-05T00:00:00Z');
const fimDoMandato = new Date('2031-01-04T23:59:59Z');

describe('Periodo', () => {
  it('contém instantes entre início e fim, inclusive as bordas', () => {
    const resultado = Periodo.criar(posse, fimDoMandato);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const mandato = resultado.value;
    expect(mandato.contem(posse)).toBe(true);
    expect(mandato.contem(fimDoMandato)).toBe(true);
    expect(mandato.contem(new Date('2026-12-31T00:00:00Z'))).toBe(false);
    expect(mandato.estaEmAberto()).toBe(false);
  });

  it('em aberto contém qualquer instante após o início', () => {
    const resultado = Periodo.criar(posse);
    expect(resultado.ok && resultado.value.contem(new Date('2040-01-01T00:00:00Z'))).toBe(true);
  });

  it('rejeita fim anterior ao início e datas inválidas', () => {
    const invertido = Periodo.criar(fimDoMandato, posse);
    expect(!invertido.ok && invertido.error.code).toBe('periodo.fim_antes_do_inicio');
    expect(Periodo.criar(new Date('invalida')).ok).toBe(false);
  });

  it('não expõe as datas internas para mutação', () => {
    const resultado = Periodo.criar(posse);
    if (!resultado.ok) throw new Error('período inválido');
    resultado.value.inicio.setFullYear(1990);
    expect(resultado.value.inicio.getTime()).toBe(posse.getTime());
  });
});

describe('Result.all', () => {
  it('devolve o primeiro erro ou todos os valores', () => {
    expect(Result.all([Result.ok(1), Result.ok(2)])).toEqual(Result.ok([1, 2]));
    expect(Result.all([Result.ok(1), Result.fail('a'), Result.fail('b')])).toEqual(
      Result.fail('a'),
    );
  });
});
