import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { criarEvento } from '@prometeu/shared-kernel';
import { sql } from 'drizzle-orm';
import { pgSchema } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BancoDoContexto } from './banco.js';
import { BarramentoPgBoss } from './barramento.js';
import { consumidorIdempotente } from './consumidor.js';
import { comCorrelacao } from './correlacao.js';
import { gravarNaOutbox, RelayDaOutbox } from './outbox.js';
import { definirInbox, definirOutbox } from './tabelas.js';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from './testes/index.js';

// Um schema de contexto ainda sem módulo serve de cobaia, com o usuário real desse contexto.
const SCHEMA = 'editorial';
const schema = pgSchema(SCHEMA);
const outbox = definirOutbox(schema);
const inbox = definirInbox(schema);

const umEvento = (n: number) =>
  criarEvento({
    tipo: 'AlgoAconteceu',
    idDoAgregado: `agregado-${n}`,
    dados: { n },
    ocorridoEm: new Date(Date.UTC(2026, 9, 30, 9, 0, n)),
  });

const umEnvelope = (id: string, idDeCorrelacao = 'cadeia-1'): EnvelopeDeEvento => ({
  id,
  tipo: 'AlgoAconteceu',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: 'agregado-1',
  idDeCorrelacao,
  dados: {},
});

describe('infraestrutura de eventos contra PostgreSQL real', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(SCHEMA, postgres.urlDoContexto(SCHEMA));
    await banco.drizzle.execute(sql`
      CREATE TABLE editorial.outbox (
        id uuid PRIMARY KEY, tipo text NOT NULL, versao integer NOT NULL,
        ocorrido_em timestamptz NOT NULL, id_do_agregado text NOT NULL,
        id_de_correlacao text NOT NULL, dados jsonb NOT NULL, publicado_em timestamptz
      );
      CREATE TABLE editorial.inbox (
        id_do_evento uuid NOT NULL, consumidor text NOT NULL,
        processado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id_do_evento, consumidor)
      );
    `);
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  beforeEach(async () => {
    await banco.drizzle.execute(sql`TRUNCATE editorial.outbox, editorial.inbox`);
  });

  it('descarta os eventos quando a transação do agregado falha', async () => {
    await expect(
      banco.transacao(async (tx) => {
        await gravarNaOutbox(tx, outbox, [umEvento(1)]);
        throw new Error('falha ao gravar o agregado');
      }),
    ).rejects.toThrow('falha ao gravar o agregado');

    expect(await banco.drizzle.select().from(outbox)).toEqual([]);
  });

  it('o relay publica em ordem, marca como publicado e não repete', async () => {
    const barramento = new BarramentoEmMemoria();
    const relay = new RelayDaOutbox(banco, outbox, barramento);
    await comCorrelacao('cadeia-7', () =>
      banco.transacao((tx) => gravarNaOutbox(tx, outbox, [umEvento(2), umEvento(1)])),
    );

    expect(await relay.publicarPendentes()).toBe(2);
    expect(await relay.publicarPendentes()).toBe(0);

    expect(barramento.publicados.map((e) => e.idDoAgregado)).toEqual(['agregado-1', 'agregado-2']);
    expect(barramento.publicados.map((e) => e.idDeCorrelacao)).toEqual(['cadeia-7', 'cadeia-7']);
    expect(barramento.publicados[0]?.ocorridoEm).toBe('2026-10-30T09:00:01.000Z');
  });

  it('o consumidor produz efeito uma única vez por evento', async () => {
    const efeitos: string[] = [];
    const manipular = consumidorIdempotente(banco, inbox, 'teste.contar', async (envelope) => {
      efeitos.push(envelope.id);
      await Promise.resolve();
    });
    const envelope = umEnvelope('0192d5e0-0000-7000-8000-000000000001');

    await manipular(envelope);
    await manipular(envelope);

    expect(efeitos).toEqual([envelope.id]);
  });

  it('efeito que falha não fica registrado na inbox, e a nova tentativa funciona', async () => {
    let tentativas = 0;
    const manipular = consumidorIdempotente(banco, inbox, 'teste.instavel', async () => {
      tentativas += 1;
      await Promise.resolve();
      if (tentativas === 1) throw new Error('banco de outro sistema fora do ar');
    });
    const envelope = umEnvelope('0192d5e0-0000-7000-8000-000000000002');

    await expect(manipular(envelope)).rejects.toThrow('fora do ar');
    await manipular(envelope);

    expect(tentativas).toBe(2);
  });

  it('eventos gerados pelo consumidor continuam a cadeia de correlação do evento recebido', async () => {
    const manipular = consumidorIdempotente(banco, inbox, 'teste.reagir', (envelope) =>
      gravarNaOutbox(banco.executor, outbox, [umEvento(3)]).then(() => {
        expect(envelope.idDeCorrelacao).toBe('cadeia-origem');
      }),
    );

    await manipular(umEnvelope('0192d5e0-0000-7000-8000-000000000003', 'cadeia-origem'));

    const [gravado] = await banco.drizzle.select().from(outbox);
    expect(gravado?.idDeCorrelacao).toBe('cadeia-origem');
  });

  it('o pg-boss entrega o mesmo evento a cada consumidor assinante, uma vez', async () => {
    // Uma instância anterior do worker já criou as filas; assinar de novo as reaproveita.
    const anterior = await BarramentoPgBoss.iniciar(postgres.urlDoContexto('barramento'));
    await anterior.assinar('AlgoAconteceu', 'consulta.projetar', () => Promise.resolve());
    await anterior.fechar();
    const barramento = await BarramentoPgBoss.iniciar(postgres.urlDoContexto('barramento'));
    const recebidos: string[] = [];
    let concluir!: () => void;
    const todosRecebidos = new Promise<void>((resolver) => (concluir = resolver));
    const receber = (quem: string) => (envelope: EnvelopeDeEvento) => {
      recebidos.push(`${quem}:${envelope.id}`);
      if (recebidos.length === 2) concluir();
      return Promise.resolve();
    };

    try {
      await barramento.assinar('AlgoAconteceu', 'consulta.projetar', receber('consulta'));
      await barramento.assinar('AlgoAconteceu', 'engajamento.alertar', receber('engajamento'));
      await barramento.publicar(umEnvelope('0192d5e0-0000-7000-8000-000000000004'));
      await todosRecebidos;
    } finally {
      await barramento.fechar();
    }

    expect(recebidos.toSorted()).toEqual([
      'consulta:0192d5e0-0000-7000-8000-000000000004',
      'engajamento:0192d5e0-0000-7000-8000-000000000004',
    ]);
  });

  it('um evento que falha não impede os outros do mesmo lote', async () => {
    const barramento = await BarramentoPgBoss.iniciar(postgres.urlDoContexto('barramento'));
    const QUEBRADO = '0192d5e0-0000-7000-8000-000000000005';
    const BOM = '0192d5e0-0000-7000-8000-000000000006';
    let concluir!: () => void;
    const bomRecebido = new Promise<void>((resolver) => (concluir = resolver));

    try {
      await barramento.assinar('OutraCoisaAconteceu', 'teste.isolar', (envelope) => {
        if (envelope.id === QUEBRADO) return Promise.reject(new Error('evento quebrado'));
        concluir();
        return Promise.resolve();
      });
      await barramento.publicar({ ...umEnvelope(QUEBRADO), tipo: 'OutraCoisaAconteceu' });
      await barramento.publicar({ ...umEnvelope(BOM), tipo: 'OutraCoisaAconteceu' });
      await bomRecebido;
    } finally {
      await barramento.fechar();
    }
  });
});
