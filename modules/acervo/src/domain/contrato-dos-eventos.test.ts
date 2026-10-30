import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { describe, expect, it } from 'vitest';

import { AGORA, umaEntrada } from '../testes/dados.js';
import { Captura } from './captura.js';
import { HashSha256 } from './hash-sha256.js';

describe('eventos do Acervo respeitam os contratos publicados (packages/contracts/eventos)', () => {
  it('CapturaRegistrada', () => {
    const entrada = umaEntrada();
    const sha256 = HashSha256.de(entrada.sha256);
    if (!sha256.ok) throw new Error(sha256.error.message);
    const captura = Captura.registrar({ ...entrada, sha256: sha256.value }, AGORA);
    if (!captura.ok) throw new Error(captura.error.message);

    const [evento] = captura.value.pullDomainEvents();

    expect(evento && violacoesDoContrato(evento.tipo, evento.versao, evento.dados)).toEqual([]);
  });
});
