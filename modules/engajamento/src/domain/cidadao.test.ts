import { describe, expect, it } from 'vitest';

import { Alvo } from './alvo.js';
import { Cidadao, CidadaoId, LIMITE_DE_ACOMPANHAMENTOS } from './cidadao.js';

const ONTEM = new Date('2026-10-31T12:00:00Z');
const HOJE = new Date('2026-11-01T12:00:00Z');

function valor<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`Esperava sucesso: ${JSON.stringify(r.error)}`);
  return r.value;
}

const id = valor(CidadaoId.de('01a19334-8523-7929-8098-47676c0373dd'));
const portoAlegre = valor(Alvo.criar('municipio', '4314902'));
const deputado = valor(Alvo.criar('parlamentar', '01A18CA8-18F3-7861-A9F8-3A7105869469'));

describe('Alvo', () => {
  it('aceita parlamentar por UUID e município pelo código IBGE de 7 dígitos', () => {
    expect(deputado.chave).toBe('parlamentar:01a18ca8-18f3-7861-a9f8-3a7105869469');
    expect(portoAlegre.chave).toBe('municipio:4314902');
  });

  it.each([
    ['promessa', '01a18ca8-18f3-7861-a9f8-3a7105869469', 'alvo.tipo_invalido'],
    ['parlamentar', 'nao-e-uuid', 'alvo.id_invalido'],
    ['municipio', '43', 'alvo.id_invalido'],
    ['municipio', '9914902', 'alvo.id_invalido'],
  ])('recusa %s "%s"', (tipo, alvo, codigo) => {
    const resultado = Alvo.criar(tipo, alvo);
    expect(resultado.ok ? undefined : resultado.error.code).toBe(codigo);
  });
});

describe('Cidadao', () => {
  it('acompanha cada alvo uma vez, do mais recente para o mais antigo', () => {
    const cidadao = Cidadao.reconstituir(id, []);

    expect(valor(cidadao.acompanhar(portoAlegre, ONTEM))).toBe(true);
    expect(valor(cidadao.acompanhar(deputado, HOJE))).toBe(true);
    expect(valor(cidadao.acompanhar(portoAlegre, HOJE))).toBe(false);

    expect(cidadao.acompanhamentos.map((a) => [a.alvo.chave, a.desde])).toEqual([
      [deputado.chave, HOJE],
      [portoAlegre.chave, ONTEM],
    ]);
  });

  it('deixa de acompanhar e diz se havia o que deixar', () => {
    const cidadao = Cidadao.reconstituir(id, [{ alvo: portoAlegre, desde: ONTEM }]);

    expect(cidadao.deixarDeAcompanhar(portoAlegre)).toBe(true);
    expect(cidadao.deixarDeAcompanhar(portoAlegre)).toBe(false);
    expect(cidadao.acompanhamentos).toEqual([]);
  });

  it('para no limite, mas acompanhar de novo o que já acompanha continua valendo', () => {
    const cheio = Cidadao.reconstituir(
      id,
      Array.from({ length: LIMITE_DE_ACOMPANHAMENTOS }, (_, i) => ({
        alvo: valor(Alvo.criar('municipio', String(4300001 + i))),
        desde: ONTEM,
      })),
    );

    const resultado = cheio.acompanhar(deputado, HOJE);
    expect(resultado.ok ? undefined : resultado.error.code).toBe('acompanhamento.limite');
    expect(valor(cheio.acompanhar(valor(Alvo.criar('municipio', '4300001')), HOJE))).toBe(false);
  });

  it('guarda só o que mudou desde a leitura, para gravar sem desfazer outra aba', () => {
    const cidadao = Cidadao.reconstituir(id, [{ alvo: portoAlegre, desde: ONTEM }]);
    const outro = valor(Alvo.criar('municipio', '3550308'));

    valor(cidadao.acompanhar(deputado, HOJE));
    valor(cidadao.acompanhar(outro, HOJE));
    cidadao.deixarDeAcompanhar(outro);
    cidadao.deixarDeAcompanhar(portoAlegre);

    const { incluidos, retirados } = cidadao.pullAlteracoes();
    expect(incluidos.map((a) => a.alvo.chave)).toEqual([deputado.chave]);
    expect(retirados.map((a) => a.chave)).toEqual([portoAlegre.chave]);
    expect(cidadao.pullAlteracoes()).toEqual({ incluidos: [], retirados: [] });
  });
});
