import { describe, expect, it } from 'vitest';

import { AGORA, umaEntrada, umHash } from '../testes/dados.js';
import { CapturaRepositoryEmMemoria, RelogioFixo } from '../testes/fakes.js';
import { RegistrarCaptura } from './registrar-captura.js';

function cenario() {
  const capturas = new CapturaRepositoryEmMemoria();
  return { capturas, registrar: new RegistrarCaptura(capturas, new RelogioFixo(AGORA)) };
}

describe('RegistrarCaptura', () => {
  it('registra a captura e emite CapturaRegistrada', async () => {
    const { capturas, registrar } = cenario();

    const resultado = await registrar.execute(umaEntrada());

    expect(resultado.ok && resultado.value.nova).toBe(true);
    expect(capturas.eventos).toEqual(['CapturaRegistrada']);
    expect(capturas.salvas[0]?.registradaEm).toEqual(AGORA);
  });

  it('o mesmo conteúdo devolve sempre a mesma captura (ADR-0016)', async () => {
    const { capturas, registrar } = cenario();

    const primeira = await registrar.execute(umaEntrada());
    const repetida = await registrar.execute(umaEntrada({ url: 'https://outra.gov.br/mesmo' }));

    expect(primeira.ok && repetida.ok).toBe(true);
    if (!primeira.ok || !repetida.ok) return;
    expect(repetida.value).toEqual({ capturaId: primeira.value.capturaId, nova: false });
    expect(capturas.salvas).toHaveLength(1);
  });

  it('normaliza o hash para que maiúsculas não criem outra captura', async () => {
    const { capturas, registrar } = cenario();

    await registrar.execute(umaEntrada({ sha256: umHash('b') }));
    await registrar.execute(umaEntrada({ sha256: umHash('B') }));

    expect(capturas.salvas).toHaveLength(1);
  });

  it.each([
    [{ sha256: 'abc' }, 'captura.hash_invalido'],
    [{ fonte: 'Câmara' }, 'captura.fonte_invalida'],
    [{ url: 'ftp://arquivo.gov.br/x' }, 'captura.url_invalida'],
    [{ url: 'não é url' }, 'captura.url_invalida'],
    [{ coletadaEm: new Date('2026-10-31T00:00:00Z') }, 'captura.coleta_no_futuro'],
    [{ coletadaEm: new Date('data ruim') }, 'captura.data_invalida'],
    [{ caminho: ' ' }, 'captura.sem_caminho'],
  ])('recusa %o com %s', async (sobrescrever, codigo) => {
    const { capturas, registrar } = cenario();

    const resultado = await registrar.execute(umaEntrada(sobrescrever));

    expect(resultado.ok ? undefined : resultado.error.code).toBe(codigo);
    expect(capturas.salvas).toEqual([]);
  });
});
