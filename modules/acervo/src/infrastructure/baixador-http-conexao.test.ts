import { describe, expect, it } from 'vitest';

import { BaixadorHttp } from './baixador-http.js';

describe('BaixadorHttp na hora da conexão', () => {
  it('recusa quando o nome passa na conferência mas resolve para a rede interna ao conectar', async () => {
    // Simula DNS rebinding: a conferência vê um IP público; a conexão resolve `localhost` de verdade.
    const baixador = new BaixadorHttp({
      resolver: () => Promise.resolve(['200.160.2.3']),
      tempoLimiteEmMs: 5_000,
    });

    const resultado = await baixador.baixar('https://localhost/');

    expect(resultado.ok ? undefined : resultado.error.code).toBe('captura.endereco_interno');
  });
});
