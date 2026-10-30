import { describe, expect, it } from 'vitest';

import { BaixadorHttp, enderecoPublico } from './baixador-http.js';

type Resposta = { status: number; corpo?: string; cabecalhos?: Record<string, string> };

/** fetch de mentira: responde por URL e registra o que foi pedido. */
function cenario(respostas: Record<string, Resposta>, dns: Record<string, string[]> = {}) {
  const pedidos: string[] = [];
  const baixador = new BaixadorHttp({
    tamanhoMaximoEmBytes: 16,
    resolver: (host) => Promise.resolve(dns[host] ?? ['200.160.2.3']),
    buscar: (url: string) => {
      pedidos.push(url);
      const r = respostas[url];
      if (!r) return Promise.reject(new Error('sem rede'));
      return Promise.resolve(
        new Response(r.corpo ?? null, { status: r.status, headers: r.cabecalhos ?? {} }),
      );
    },
  });
  return { baixador, pedidos };
}

const PDF = { 'content-type': 'application/pdf' };

describe('BaixadorHttp', () => {
  it('baixa um documento público', async () => {
    const { baixador } = cenario({
      'https://www.tse.jus.br/plano.pdf': { status: 200, corpo: '%PDF-1.7', cabecalhos: PDF },
    });

    const resultado = await baixador.baixar('https://www.tse.jus.br/plano.pdf');

    expect(resultado.ok && resultado.value.tipoDeConteudo).toBe('application/pdf');
    expect(resultado.ok && Buffer.from(resultado.value.conteudo).toString()).toBe('%PDF-1.7');
  });

  it('segue redirecionamentos conferindo cada destino', async () => {
    const { baixador, pedidos } = cenario({
      'https://curto.gov.br/x': { status: 302, cabecalhos: { location: '/final.pdf' } },
      'https://curto.gov.br/final.pdf': { status: 200, corpo: '%PDF', cabecalhos: PDF },
    });

    const resultado = await baixador.baixar('https://curto.gov.br/x');

    expect(resultado.ok && resultado.value.url).toBe('https://curto.gov.br/final.pdf');
    expect(pedidos).toHaveLength(2);
  });

  it.each([
    ['http://www.tse.jus.br/plano.pdf', 'captura.url_invalida'],
    ['https://usuario:senha@tse.jus.br/x', 'captura.url_invalida'],
    ['https://127.0.0.1/admin', 'captura.endereco_interno'],
    ['https://[::1]/admin', 'captura.endereco_interno'],
    ['https://[::ffff:127.0.0.1]/admin', 'captura.endereco_interno'],
    ['https://[::ffff:a00:1]/admin', 'captura.endereco_interno'],
    ['https://[64:ff9b::a00:1]/admin', 'captura.endereco_interno'],
    ['https://169.254.169.254/latest/meta-data', 'captura.endereco_interno'],
    ['https://interno.empresa/x', 'captura.endereco_interno'],
    ['ftp://arquivos.gov.br/x', 'captura.url_invalida'],
  ])('recusa %s', async (url, codigo) => {
    const { baixador, pedidos } = cenario({}, { 'interno.empresa': ['10.0.0.8'] });

    const resultado = await baixador.baixar(url);

    expect(resultado.ok ? undefined : resultado.error.code).toBe(codigo);
    expect(pedidos).toEqual([]);
  });

  it('não deixa um redirecionamento levar para a rede interna', async () => {
    const { baixador, pedidos } = cenario({
      'https://publico.gov.br/x': {
        status: 301,
        cabecalhos: { location: 'https://169.254.169.254/latest/meta-data' },
      },
    });

    const resultado = await baixador.baixar('https://publico.gov.br/x');

    expect(resultado.ok ? undefined : resultado.error.code).toBe('captura.endereco_interno');
    expect(pedidos).toEqual(['https://publico.gov.br/x']);
  });

  it('recusa nome que resolve para endereço público e interno ao mesmo tempo', async () => {
    const { baixador } = cenario({}, { 'misto.gov.br': ['200.160.2.3', '192.168.0.10'] });
    const resultado = await baixador.baixar('https://misto.gov.br/x');
    expect(resultado.ok ? undefined : resultado.error.code).toBe('captura.endereco_interno');
  });

  it.each([
    [
      { status: 200, corpo: 'x', cabecalhos: { 'content-type': 'application/zip' } },
      'captura.tipo_nao_aceito',
    ],
    [{ status: 200, corpo: '0123456789abcdefXYZ', cabecalhos: PDF }, 'captura.grande_demais'],
    [{ status: 200, corpo: '', cabecalhos: PDF }, 'captura.vazia'],
    [{ status: 404 }, 'captura.fonte_indisponivel'],
  ])('recusa resposta inadequada (%#)', async (resposta, codigo) => {
    const { baixador } = cenario({ 'https://fonte.gov.br/x': resposta });
    const resultado = await baixador.baixar('https://fonte.gov.br/x');
    expect(resultado.ok ? undefined : resultado.error.code).toBe(codigo);
  });

  it('desiste de redirecionamentos em ciclo', async () => {
    const { baixador } = cenario({
      'https://ciclo.gov.br/a': { status: 302, cabecalhos: { location: '/b' } },
      'https://ciclo.gov.br/b': { status: 302, cabecalhos: { location: '/a' } },
    });
    const resultado = await baixador.baixar('https://ciclo.gov.br/a');
    expect(resultado.ok ? undefined : resultado.error.code).toBe(
      'captura.redirecionamentos_demais',
    );
  });
});

describe('enderecoPublico', () => {
  it.each([
    ['200.160.2.3', true],
    ['2804:14c::1', true],
    ['10.1.2.3', false],
    ['172.20.0.1', false],
    ['100.64.0.1', false],
    ['fd00::1', false],
    ['::ffff:127.0.0.1', false],
    ['::ffff:7f00:1', false],
    ['0:0:0:0:0:ffff:7f00:1', false],
    ['::ffff:c8a0:203', true],
    ['não é ip', false],
  ])('%s é público: %s', (ip, esperado) => {
    expect(enderecoPublico(ip)).toBe(esperado);
  });
});
