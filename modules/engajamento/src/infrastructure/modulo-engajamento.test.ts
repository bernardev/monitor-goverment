import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import { iniciarPostgresDeTeste, type PostgresDeTeste } from '@prometeu/infraestrutura/testes';
import { gerarUuidV7 } from '@prometeu/shared-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MIGRACOES_DE_ENGAJAMENTO,
  type ModuloEngajamento,
  montarEngajamento,
  SCHEMA_DE_ENGAJAMENTO,
} from '../index.js';

const DEPUTADO = '01a18ca8-18f3-7861-a9f8-3a7105869469';
const PORTO_ALEGRE = '4314902';

describe('módulo Engajamento montado sobre o PostgreSQL', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let modulo: ModuloEngajamento;
  let agora = new Date('2026-11-01T12:00:00Z');

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DE_ENGAJAMENTO,
      postgres.urlDoContexto(SCHEMA_DE_ENGAJAMENTO),
    );
    await migrar(banco, MIGRACOES_DE_ENGAJAMENTO);
    modulo = montarEngajamento(banco, { agora: () => agora });
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  const lista = async (cidadaoId: string) => {
    const r = await modulo.listarAcompanhamentos.execute(cidadaoId);
    if (!r.ok) throw new Error(r.error.message);
    return r.value.map((a) => `${a.tipo}:${a.id}`);
  };

  it('acompanha, lista do mais recente ao mais antigo e deixa de acompanhar', async () => {
    const cidadao = gerarUuidV7();
    const ok = (r: { ok: boolean }) => {
      expect(r.ok).toBe(true);
    };

    ok(
      await modulo.acompanhar.execute({ cidadaoId: cidadao, tipo: 'municipio', id: PORTO_ALEGRE }),
    );
    agora = new Date('2026-11-01T13:00:00Z');
    ok(await modulo.acompanhar.execute({ cidadaoId: cidadao, tipo: 'parlamentar', id: DEPUTADO }));
    ok(
      await modulo.acompanhar.execute({ cidadaoId: cidadao, tipo: 'municipio', id: PORTO_ALEGRE }),
    );
    expect(await lista(cidadao)).toEqual([`parlamentar:${DEPUTADO}`, `municipio:${PORTO_ALEGRE}`]);

    ok(
      await modulo.deixarDeAcompanhar.execute({
        cidadaoId: cidadao,
        tipo: 'municipio',
        id: PORTO_ALEGRE,
      }),
    );
    expect(await lista(cidadao)).toEqual([`parlamentar:${DEPUTADO}`]);
    // Cada pessoa vê só o que ela acompanha.
    expect(await lista(gerarUuidV7())).toEqual([]);
  });

  it('esquecer apaga tudo da pessoa e de mais ninguém', async () => {
    const quemSai = gerarUuidV7();
    const quemFica = gerarUuidV7();
    for (const cidadaoId of [quemSai, quemFica]) {
      await modulo.acompanhar.execute({ cidadaoId, tipo: 'municipio', id: PORTO_ALEGRE });
    }

    expect((await modulo.esquecerCidadao.execute(quemSai)).ok).toBe(true);

    expect(await lista(quemSai)).toEqual([]);
    expect(await lista(quemFica)).toEqual([`municipio:${PORTO_ALEGRE}`]);
  });

  it('recusa alvo e pessoa inválidos sem gravar nada', async () => {
    const cidadao = gerarUuidV7();
    const codigo = async (tipo: string, id: string, cidadaoId = cidadao) => {
      const r = await modulo.acompanhar.execute({ cidadaoId, tipo, id });
      return r.ok ? 'ok' : r.error.code;
    };

    expect(await codigo('promessa', DEPUTADO)).toBe('alvo.tipo_invalido');
    expect(await codigo('municipio', '123')).toBe('alvo.id_invalido');
    expect(await codigo('municipio', PORTO_ALEGRE, 'nao-e-uuid')).toBe('identificador.invalido');
    expect(await lista(cidadao)).toEqual([]);
  });
});
