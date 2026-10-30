import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import { iniciarPostgresDeTeste, type PostgresDeTeste } from '@prometeu/infraestrutura/testes';
import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Promessa } from '../domain/promessa.js';
import {
  HOJE,
  ONTEM,
  umaCaptura,
  umaFonte,
  umAlvo,
  umaPromessa,
  umCurador,
  valor,
} from '../testes/construtores.js';
import { Trecho } from '../domain/trecho.js';
import { outbox } from './esquema.js';
import {
  ConflitoDeConcorrencia,
  PromessaRepositoryPostgres,
} from './promessa-repository-postgres.js';

const MIGRACOES = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** O que importa comparar entre a promessa gravada e a recarregada. */
function retrato(p: Promessa) {
  return {
    id: p.id.valor,
    autor: p.autor,
    texto: p.texto.valor,
    estagio: p.estagio,
    vereditoVigente: p.vereditoVigente,
    fontes: p.fontes.map((f) => [f.id.valor, f.tipo, f.trecho, f.dataDaDeclaracao]),
    vinculos: p.vinculos.map((v) => [v.id.valor, v.situacao, v.alvo, v.decididoPor?.valor]),
    historico: p.historicoDeVereditos.map((r) => [
      r.id.valor,
      r.veredito,
      r.fundamento,
      r.revisadoPor.valor,
      r.corrige?.valor,
    ]),
    proposta: p.propostaPendente,
  };
}

describe('PromessaRepositoryPostgres', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar('compromissos', postgres.urlDoContexto('compromissos'));
    await migrar(banco, MIGRACOES);
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('grava e recarrega o ciclo completo: fontes, vínculos, histórico, errata e proposta', async () => {
    const repositorio = new PromessaRepositoryPostgres(banco);
    const promessa = umaPromessa().comVereditosPublicados('em_andamento').build();
    const curador = umCurador();
    const revisor = umCurador();

    valor(
      promessa.adicionarFonte(
        umaFonte({
          tipo: 'debate',
          trecho: valor(
            Trecho.criar('Creche em todo bairro.', {
              tipo: 'intervalo_de_tempo',
              inicioEmSegundos: 61,
              fimEmSegundos: 75,
            }),
          ),
        }),
        curador,
        HOJE,
      ),
    );
    const vinculo = valor(
      promessa.sugerirVinculo(
        {
          alvo: umAlvo('obra'),
          estagioQueComprova: 'execucao',
          origem: 'curador',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );
    valor(promessa.confirmarVinculo(vinculo, revisor, HOJE));
    const atoContrario = umaCaptura();
    valor(
      promessa.proporVeredito({
        veredito: 'nao_cumprida',
        justificativa: 'Lei revogou o programa.',
        evidencias: [atoContrario],
        fundamento: { tipo: 'ato_em_sentido_contrario', evidencia: atoContrario },
        propostoPor: curador,
        propostoEm: HOJE,
      }),
    );
    valor(promessa.publicarVeredito(revisor, HOJE));
    valor(
      promessa.proporVeredito({
        veredito: 'em_andamento',
        justificativa: 'A revogação foi anulada pelo STF; o veredito anterior estava errado.',
        evidencias: [umaCaptura()],
        errata: true,
        propostoPor: curador,
        propostoEm: HOJE,
      }),
    );

    await repositorio.salvar(promessa);
    const recarregada = await new PromessaRepositoryPostgres(banco).buscarPorId(promessa.id);

    expect(recarregada && retrato(recarregada)).toEqual(retrato(promessa));
    expect(recarregada?.estagio).toBe('execucao');
    expect(recarregada?.historicoDeVereditos.map((r) => r.veredito)).toEqual([
      'em_andamento',
      'nao_cumprida',
    ]);
  });

  it('a promessa recarregada continua aplicando as regras e grava só o que mudou', async () => {
    const promessa = umaPromessa().build();
    await new PromessaRepositoryPostgres(banco).salvar(promessa);

    const repositorio = new PromessaRepositoryPostgres(banco);
    const recarregada = await repositorio.buscarPorId(promessa.id);
    if (!recarregada) throw new Error('Promessa não encontrada.');
    valor(
      recarregada.proporVeredito({
        veredito: 'nao_cumprida',
        justificativa: 'Mandato encerrado sem obra.',
        evidencias: [umaCaptura()],
        fundamento: { tipo: 'mandato_encerrado', encerradoEm: ONTEM },
        propostoPor: umCurador(),
        propostoEm: HOJE,
      }),
    );
    valor(recarregada.publicarVeredito(umCurador(), HOJE));
    await repositorio.salvar(recarregada);

    const final = await new PromessaRepositoryPostgres(banco).buscarPorId(promessa.id);
    expect(final?.vereditoVigente).toBe('nao_cumprida');
    expect(final?.propostaPendente).toBeUndefined();
  });

  it('grava os eventos na outbox respeitando os contratos publicados', async () => {
    await banco.drizzle.execute(sql`DELETE FROM compromissos.outbox`);
    const promessa = umaPromessa().build();
    valor(promessa.adicionarFonte(umaFonte(), umCurador(), HOJE));

    await new PromessaRepositoryPostgres(banco).salvar(promessa);

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo)).toEqual(['FonteAdicionada']);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados)).toEqual([]);
    }
  });

  it('duas gravações sobre a mesma versão: a segunda falha', async () => {
    const promessa = umaPromessa().build();
    await new PromessaRepositoryPostgres(banco).salvar(promessa);
    const [a, b] = [new PromessaRepositoryPostgres(banco), new PromessaRepositoryPostgres(banco)];
    const daA = await a.buscarPorId(promessa.id);
    const daB = await b.buscarPorId(promessa.id);
    if (!daA || !daB) throw new Error('Promessa não encontrada.');
    valor(daA.adicionarFonte(umaFonte(), umCurador(), HOJE));
    valor(daB.adicionarFonte(umaFonte(), umCurador(), HOJE));

    await a.salvar(daA);

    await expect(b.salvar(daB)).rejects.toBeInstanceOf(ConflitoDeConcorrencia);
  });

  it('o banco recusa alterar ou apagar o histórico de vereditos (invariante 5)', async () => {
    const promessa = umaPromessa().comVereditosPublicados('em_andamento').build();
    await new PromessaRepositoryPostgres(banco).salvar(promessa);

    await expect(
      banco.drizzle.execute(
        sql`UPDATE compromissos.registro_de_veredito SET veredito = 'cumprida' WHERE promessa_id = ${promessa.id.valor}`,
      ),
    ).rejects.toThrow();
    await expect(
      banco.drizzle.execute(
        sql`DELETE FROM compromissos.registro_de_veredito WHERE promessa_id = ${promessa.id.valor}`,
      ),
    ).rejects.toThrow();
  });
});
