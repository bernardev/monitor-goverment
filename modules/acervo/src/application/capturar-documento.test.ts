import { createHash } from 'node:crypto';

import { DomainError, Result } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import { AGORA } from '../testes/dados.js';
import { CapturaRepositoryEmMemoria, RelogioFixo } from '../testes/fakes.js';
import {
  type ArmazemDeCapturas,
  type BaixadorDeDocumentos,
  CapturarDocumento,
} from './capturar-documento.js';

class ArmazemEmMemoria implements ArmazemDeCapturas {
  readonly guardados = new Map<string, string>();

  guardar(caminho: string, conteudo: Uint8Array): Promise<void> {
    this.guardados.set(caminho, Buffer.from(conteudo).toString());
    return Promise.resolve();
  }
}

const baixadorDe = (conteudo: string): BaixadorDeDocumentos => ({
  baixar: (url) =>
    Promise.resolve(
      Result.ok({ url, conteudo: Buffer.from(conteudo), tipoDeConteudo: 'application/pdf' }),
    ),
});

function cenario(baixador: BaixadorDeDocumentos = baixadorDe('%PDF plano de governo')) {
  const capturas = new CapturaRepositoryEmMemoria();
  const armazem = new ArmazemEmMemoria();
  const capturar = new CapturarDocumento(capturas, baixador, armazem, new RelogioFixo(AGORA));
  return { capturas, armazem, capturar };
}

describe('CapturarDocumento', () => {
  it('guarda o conteúdo pelo hash e registra a captura da curadoria', async () => {
    const { capturas, armazem, capturar } = cenario();

    const resultado = await capturar.execute({ url: 'https://tse.jus.br/plano.pdf' });

    const sha256 = createHash('sha256').update('%PDF plano de governo').digest('hex');
    expect(resultado.ok && resultado.value).toMatchObject({ sha256, nova: true });
    expect([...armazem.guardados.keys()]).toEqual([`capturas/curadoria/2026/10/30/${sha256}`]);
    expect(capturas.salvas[0]).toMatchObject({
      fonte: 'curadoria',
      url: 'https://tse.jus.br/plano.pdf',
    });
    expect(capturas.eventos).toEqual(['CapturaRegistrada']);
  });

  it('o mesmo conteúdo, de outro endereço, devolve a captura que já existe', async () => {
    const { capturas, capturar } = cenario();
    const primeira = await capturar.execute({ url: 'https://tse.jus.br/plano.pdf' });

    const repetida = await capturar.execute({ url: 'https://espelho.gov.br/plano.pdf' });

    expect(primeira.ok && repetida.ok).toBe(true);
    if (!primeira.ok || !repetida.ok) return;
    expect(repetida.value).toEqual({ ...primeira.value, nova: false });
    expect(capturas.salvas).toHaveLength(1);
  });

  it('falha ao baixar não registra nada', async () => {
    const { capturas, armazem, capturar } = cenario({
      baixar: () =>
        Promise.resolve(Result.fail(new DomainError('captura.endereco_interno', 'Rede interna.'))),
    });

    const resultado = await capturar.execute({ url: 'https://10.0.0.1/x' });

    expect(resultado.ok ? undefined : resultado.error.code).toBe('captura.endereco_interno');
    expect(capturas.salvas).toEqual([]);
    expect(armazem.guardados.size).toBe(0);
  });
});
