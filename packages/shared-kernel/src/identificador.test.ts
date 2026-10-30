import { describe, expect, it } from 'vitest';

import type { DomainError } from './domain-error.js';
import { Identificador, gerarUuidV7 } from './identificador.js';
import type { Result } from './result.js';

class PessoaIdDeTeste extends Identificador {
  static gerar(): PessoaIdDeTeste {
    return new PessoaIdDeTeste(gerarUuidV7());
  }

  static de(valor: string): Result<PessoaIdDeTeste, DomainError> {
    const validado = Identificador.validar(valor);
    return validado.ok ? { ok: true, value: new PessoaIdDeTeste(validado.value) } : validado;
  }
}

class OutroIdDeTeste extends Identificador {
  static de(valor: string): OutroIdDeTeste {
    return new OutroIdDeTeste(valor);
  }
}

describe('gerarUuidV7', () => {
  it('gera UUID versão 7 com variante RFC 9562', () => {
    const uuid = gerarUuidV7();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('codifica o instante nos primeiros 48 bits, o que ordena por criação', () => {
    const instante = Date.UTC(2027, 0, 1);
    const uuid = gerarUuidV7(instante);
    expect(parseInt(uuid.replace('-', '').slice(0, 12), 16)).toBe(instante);
    expect(gerarUuidV7(instante) < gerarUuidV7(instante + 1)).toBe(true);
  });
});

describe('Identificador', () => {
  it('normaliza e valida o texto', () => {
    const id = PessoaIdDeTeste.gerar();
    const lido = PessoaIdDeTeste.de(` ${id.valor.toUpperCase()} `);
    expect(lido.ok && lido.value.equals(id)).toBe(true);
    expect(PessoaIdDeTeste.de('nao-e-uuid').ok).toBe(false);
  });

  it('não considera iguais identificadores de tipos diferentes com o mesmo valor', () => {
    const valor = gerarUuidV7();
    const pessoa = PessoaIdDeTeste.de(valor);
    expect(pessoa.ok && pessoa.value.equals(OutroIdDeTeste.de(valor))).toBe(false);
  });
});
