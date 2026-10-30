import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import { iniciarPostgresDeTeste, type PostgresDeTeste } from '@prometeu/infraestrutura/testes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MIGRACOES_DO_ACERVO, montarAcervo, SCHEMA_DO_ACERVO } from '../index.js';
import { AGORA, umaEntrada, umHash } from '../testes/dados.js';
import { RelogioFixo } from '../testes/fakes.js';
import { outbox } from './esquema.js';

describe('Acervo no PostgreSQL', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(SCHEMA_DO_ACERVO, postgres.urlDoContexto(SCHEMA_DO_ACERVO));
    await migrar(banco, MIGRACOES_DO_ACERVO);
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('grava a captura com o evento na outbox e a encontra de novo pelo hash', async () => {
    const acervo = montarAcervo(banco, new RelogioFixo(AGORA));

    const primeira = await acervo.registrarCaptura.execute(umaEntrada({ sha256: umHash('c') }));
    const repetida = await acervo.registrarCaptura.execute(umaEntrada({ sha256: umHash('c') }));

    expect(primeira.ok && repetida.ok).toBe(true);
    if (!primeira.ok || !repetida.ok) return;
    expect(repetida.value).toEqual({ capturaId: primeira.value.capturaId, nova: false });

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      tipo: 'CapturaRegistrada',
      idDoAgregado: primeira.value.capturaId,
      dados: { sha256: umHash('c'), fonte: 'camara', coletadaEm: '2026-10-30T09:00:00.000Z' },
    });
  });

  it('aplicar as migrações de novo não muda nada', async () => {
    await expect(migrar(banco, MIGRACOES_DO_ACERVO)).resolves.toBeUndefined();
  });
});
