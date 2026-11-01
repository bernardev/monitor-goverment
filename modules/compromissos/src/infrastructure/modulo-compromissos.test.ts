import type { ConsultaDeMandatos, MandatoPublicado } from '@prometeu/agentes-publicos';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from '@prometeu/infraestrutura/testes';
import { gerarUuidV7 } from '@prometeu/shared-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MIGRACOES_DE_COMPROMISSOS,
  type ModuloCompromissos,
  montarCompromissos,
  SCHEMA_DE_COMPROMISSOS,
} from '../index.js';

const AGORA = new Date('2027-03-01T12:00:00Z');
const MANDATO_ENCERRADO = gerarUuidV7();

/** Agentes Públicos de mentira: um único mandato, encerrado em janeiro de 2027. */
const mandatos: Pick<ConsultaDeMandatos, 'buscar'> = {
  buscar: (mandatoId): Promise<MandatoPublicado | undefined> =>
    Promise.resolve(
      mandatoId === MANDATO_ENCERRADO
        ? {
            mandatoId,
            pessoaId: gerarUuidV7(),
            cargo: 'deputado_federal',
            circunscricao: '35',
            inicio: new Date('2023-02-01T03:00:00Z'),
            fim: new Date('2027-02-01T02:59:59.999Z'),
          }
        : undefined,
    ),
};

describe('módulo Compromissos montado sobre o PostgreSQL', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let modulo: ModuloCompromissos;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DE_COMPROMISSOS,
      postgres.urlDoContexto(SCHEMA_DE_COMPROMISSOS),
    );
    await migrar(banco, MIGRACOES_DE_COMPROMISSOS);
    modulo = montarCompromissos({ banco, mandatos, relogio: { agora: () => AGORA } });
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('do registro ao veredito publicado, visto pelo painel de curadoria', async () => {
    const curador = gerarUuidV7();
    const revisor = gerarUuidV7();
    const captura = gerarUuidV7();
    const registrada = await modulo.registrarPromessa.execute({
      pessoaId: gerarUuidV7(),
      mandatoId: MANDATO_ENCERRADO,
      texto: 'Construir 500 creches até 2026',
      tema: 'educacao',
      mensurabilidade: 'mensuravel',
      competencia: 'propria',
      fonte: {
        tipo: 'plano_de_governo',
        capturaId: captura,
        citacaoLiteral: 'Vamos construir 500 creches.',
        localizacao: { tipo: 'pagina', pagina: 12 },
        dataDaDeclaracao: new Date('2022-08-15T12:00:00Z'),
      },
      registradoPor: curador,
    });
    if (!registrada.ok) throw new Error(registrada.error.message);
    const { promessaId } = registrada.value;

    const proposta = await modulo.proporVeredito.execute({
      promessaId,
      veredito: 'nao_cumprida',
      justificativa: 'O mandato terminou sem nenhuma creche entregue.',
      evidencias: [captura],
      fundamento: { tipo: 'mandato_encerrado' },
      propostoPor: curador,
    });
    expect(proposta.ok).toBe(true);

    const pendente = await modulo.consultaEditorial.listar();
    expect(pendente.find((p) => p.promessaId === promessaId)?.aguardandoRevisao).toBe(true);

    const mesmaPessoa = await modulo.publicarVeredito.execute({ promessaId, revisadoPor: curador });
    expect(mesmaPessoa.ok ? undefined : mesmaPessoa.error.code).toBe(
      'veredito.revisor_igual_ao_curador',
    );
    expect((await modulo.publicarVeredito.execute({ promessaId, revisadoPor: revisor })).ok).toBe(
      true,
    );

    // A lista do painel mostra o mesmo veredito vigente que a promessa.
    const naLista = (await modulo.consultaEditorial.listar()).find(
      (p) => p.promessaId === promessaId,
    );
    expect(naLista).toMatchObject({ vereditoVigente: 'nao_cumprida', aguardandoRevisao: false });

    const vista = await modulo.consultaEditorial.buscar(promessaId);
    expect(vista).toMatchObject({
      vereditoVigente: 'nao_cumprida',
      aguardandoRevisao: false,
      propostaPendente: null,
      fontes: [{ tipo: 'plano_de_governo', localizacao: { tipo: 'pagina', pagina: 12 } }],
      historico: [
        { veredito: 'nao_cumprida', fundamento: 'mandato_encerrado', revisadoPor: revisor },
      ],
    });
  });

  it('não aceita mandato_encerrado quando Agentes Públicos não conhece o mandato', async () => {
    const registrada = await modulo.registrarPromessa.execute({
      pessoaId: gerarUuidV7(),
      mandatoId: gerarUuidV7(),
      texto: 'Asfaltar 100 km',
      tema: 'infraestrutura',
      mensurabilidade: 'mensuravel',
      competencia: 'propria',
      fonte: {
        tipo: 'debate',
        capturaId: gerarUuidV7(),
        citacaoLiteral: 'Cem quilômetros de asfalto.',
        localizacao: { tipo: 'intervalo_de_tempo', inicioEmSegundos: 10, fimEmSegundos: 20 },
        dataDaDeclaracao: new Date('2022-09-01T12:00:00Z'),
      },
      registradoPor: gerarUuidV7(),
    });
    if (!registrada.ok) throw new Error(registrada.error.message);

    const proposta = await modulo.proporVeredito.execute({
      promessaId: registrada.value.promessaId,
      veredito: 'nao_cumprida',
      justificativa: 'Sem asfalto.',
      evidencias: [gerarUuidV7()],
      fundamento: { tipo: 'mandato_encerrado' },
      propostoPor: gerarUuidV7(),
    });

    expect(proposta.ok ? undefined : proposta.error.code).toBe('veredito.mandato_em_curso');
  });

  it('obra paralisada vira pedido de reavaliação no painel, uma vez só, até a curadoria concluir', async () => {
    const barramento = new BarramentoEmMemoria();
    await modulo.assinarConsumidores(barramento);
    const obra = gerarUuidV7();
    const captura = gerarUuidV7();
    const registrada = await modulo.registrarPromessa.execute({
      pessoaId: gerarUuidV7(),
      mandatoId: MANDATO_ENCERRADO,
      texto: 'Terminar a ponte do Sapucaia',
      tema: 'infraestrutura',
      mensurabilidade: 'mensuravel',
      competencia: 'propria',
      fonte: {
        tipo: 'entrevista',
        capturaId: gerarUuidV7(),
        citacaoLiteral: 'A ponte sai.',
        localizacao: { tipo: 'pagina', pagina: 1 },
        dataDaDeclaracao: new Date('2022-09-01T12:00:00Z'),
      },
      registradoPor: gerarUuidV7(),
    });
    if (!registrada.ok) throw new Error(registrada.error.message);
    const { promessaId } = registrada.value;
    const sugerido = await modulo.sugerirVinculo.execute({
      promessaId,
      tipoDoAlvo: 'obra',
      idDoAlvo: obra,
      estagioQueComprova: 'execucao',
      origem: 'curador',
      evidencias: [gerarUuidV7()],
    });
    if (!sugerido.ok) throw new Error(sugerido.error.message);
    const confirmado = await modulo.confirmarVinculo.execute({
      promessaId,
      vinculoId: sugerido.value.vinculoId,
      confirmadoPor: gerarUuidV7(),
    });
    expect(confirmado.ok).toBe(true);

    const paralisada = {
      id: gerarUuidV7(),
      tipo: 'ObraParalisada',
      versao: 1,
      ocorridoEm: AGORA.toISOString(),
      idDoAgregado: obra,
      idDeCorrelacao: gerarUuidV7(),
      dados: {
        idNaFonte: '1.2',
        em: '2027-02-10',
        justificativa: null,
        emendas: [],
        capturaId: captura,
      },
    };
    await barramento.publicar(paralisada);
    await barramento.publicar({ ...paralisada, id: gerarUuidV7() });

    expect((await modulo.consultaEditorial.buscar(promessaId))?.reavaliacoes).toEqual([
      {
        tipoDoAlvo: 'obra',
        idDoAlvo: obra,
        motivo: 'A obra foi paralisada em 10/02/2027.',
        capturaId: captura,
        pedidoEm: AGORA.toISOString(),
      },
    ]);
    const naLista = (await modulo.consultaEditorial.listar()).find(
      (p) => p.promessaId === promessaId,
    );
    expect(naLista?.reavaliacoesPendentes).toBe(1);

    const concluida = await modulo.concluirReavaliacao.execute({
      promessaId,
      concluidaPor: gerarUuidV7(),
    });
    expect(concluida.ok).toBe(true);
    expect((await modulo.consultaEditorial.buscar(promessaId))?.reavaliacoesPendentes).toBe(0);
  });

  it('busca de id inválido ou inexistente não encontra nada', async () => {
    expect(await modulo.consultaEditorial.buscar('nao-e-uuid')).toBeUndefined();
    expect(await modulo.consultaEditorial.buscar(gerarUuidV7())).toBeUndefined();
  });
});
