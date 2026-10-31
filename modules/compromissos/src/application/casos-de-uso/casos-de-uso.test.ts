import { gerarUuidV7 } from '@prometeu/shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { MandatoId } from '../../domain/identificadores.js';
import { HOJE, ONTEM, erro, valor } from '../../testes/construtores.js';
import { MandatosEmMemoria, PromessaRepositoryEmMemoria, RelogioFixo } from '../../testes/fakes.js';
import { AdicionarFonte } from './adicionar-fonte.js';
import { PublicarVeredito, RecusarVeredito } from './decidir-veredito.js';
import { ConfirmarVinculo, RejeitarVinculo } from './decidir-vinculo.js';
import { ProporVeredito } from './propor-veredito.js';
import { ConcluirReavaliacao, SolicitarReavaliacao } from './reavaliar.js';
import { RegistrarPromessa, type RegistrarPromessaInput } from './registrar-promessa.js';
import { SugerirVinculo } from './sugerir-vinculo.js';

const uuid = (): string => gerarUuidV7();

function entradaDeRegistro(mandatoId = uuid()): RegistrarPromessaInput {
  return {
    pessoaId: uuid(),
    mandatoId,
    texto: 'Construir 500 creches até 2028',
    tema: 'educacao',
    mensurabilidade: 'mensuravel',
    competencia: 'propria',
    meta: { descricao: '500 creches', prazo: new Date('2028-12-31T00:00:00Z') },
    fonte: {
      tipo: 'plano_de_governo',
      capturaId: uuid(),
      citacaoLiteral: 'Vamos construir 500 creches até 2028.',
      localizacao: { tipo: 'pagina', pagina: 12 },
      dataDaDeclaracao: ONTEM,
    },
    registradoPor: uuid(),
  };
}

describe('Casos de uso de Compromissos', () => {
  let promessas: PromessaRepositoryEmMemoria;
  let mandatos: MandatosEmMemoria;
  let relogio: RelogioFixo;

  beforeEach(() => {
    promessas = new PromessaRepositoryEmMemoria();
    mandatos = new MandatosEmMemoria();
    relogio = new RelogioFixo(HOJE);
  });

  const registrar = (entrada = entradaDeRegistro()): Promise<string> =>
    new RegistrarPromessa(promessas, relogio)
      .execute(entrada)
      .then((resultado) => valor(resultado).promessaId);

  it('jornada completa: registrar, vincular, confirmar e publicar com revisão', async () => {
    const promessaId = await registrar();
    const curador = uuid();
    const revisor = uuid();

    valor(
      await new AdicionarFonte(promessas, relogio).execute({
        promessaId,
        adicionadaPor: curador,
        fonte: {
          tipo: 'debate',
          capturaId: uuid(),
          citacaoLiteral: 'Vou entregar as creches.',
          localizacao: { tipo: 'intervalo_de_tempo', inicioEmSegundos: 2472, fimEmSegundos: 2507 },
          dataDaDeclaracao: ONTEM,
        },
      }),
    );

    const { vinculoId } = valor(
      await new SugerirVinculo(promessas, relogio).execute({
        promessaId,
        tipoDoAlvo: 'obra',
        idDoAlvo: uuid(),
        estagioQueComprova: 'execucao',
        origem: 'sugestao_ia',
        evidencias: [uuid()],
      }),
    );
    valor(
      await new ConfirmarVinculo(promessas, relogio).execute({
        promessaId,
        vinculoId,
        confirmadoPor: curador,
      }),
    );

    const proporVeredito = new ProporVeredito(promessas, mandatos, relogio);
    const publicar = new PublicarVeredito(promessas, relogio);
    for (const veredito of ['em_andamento', 'cumprida_parcialmente']) {
      valor(
        await proporVeredito.execute({
          promessaId,
          veredito,
          justificativa: 'Obras em andamento, 200 creches entregues.',
          evidencias: [uuid()],
          propostoPor: curador,
        }),
      );
      valor(await publicar.execute({ promessaId, revisadoPor: revisor }));
    }

    expect(promessas.tiposDosEventos()).toEqual([
      'PromessaRegistrada',
      'FonteAdicionada',
      'VinculoSugerido',
      'VinculoConfirmado',
      'EstagioDaPromessaAvancou',
      'VereditoProposto',
      'VereditoPublicado',
      'VereditoProposto',
      'VereditoPublicado',
    ]);
  });

  describe('RegistrarPromessa', () => {
    it('não salva nada quando a entrada é inválida e diz qual campo falhou', async () => {
      const registrarPromessa = new RegistrarPromessa(promessas, relogio);

      const resultado = await registrarPromessa.execute({ ...entradaDeRegistro(), pessoaId: 'x' });
      expect(!resultado.ok && resultado.error.details).toMatchObject({ campo: 'pessoaId' });

      const semAutoria = await registrarPromessa.execute({
        ...entradaDeRegistro(),
        mandatoId: undefined,
      });
      expect(erro(semAutoria)).toBe('autor.sem_candidatura_nem_mandato');

      const competencia = await registrarPromessa.execute({
        ...entradaDeRegistro(),
        competencia: 'talvez',
      });
      expect(erro(competencia)).toBe('entrada.opcao_invalida');
      expect(promessas.eventos).toHaveLength(0);
    });
  });

  describe('alteração de promessa', () => {
    it('responde promessa não encontrada sem salvar nada', async () => {
      const resultado = await new PublicarVeredito(promessas, relogio).execute({
        promessaId: uuid(),
        revisadoPor: uuid(),
      });
      expect(erro(resultado)).toBe('promessa.nao_encontrada');
    });

    it('falha de regra não salva a promessa', async () => {
      const promessaId = await registrar();
      const antes = promessas.eventos.length;

      const resultado = await new RejeitarVinculo(promessas, relogio).execute({
        promessaId,
        vinculoId: uuid(),
        rejeitadoPor: uuid(),
        motivo: 'Sem relação.',
      });
      expect(erro(resultado)).toBe('vinculo.nao_encontrado');
      expect(promessas.eventos).toHaveLength(antes);
    });
  });

  describe('ProporVeredito com fundamento de não cumprimento', () => {
    it('busca o fim do mandato em Agentes Públicos em vez de confiar na entrada', async () => {
      const mandatoId = uuid();
      const promessaId = await registrar(entradaDeRegistro(mandatoId));
      const proporVeredito = new ProporVeredito(promessas, mandatos, relogio);
      const entrada = {
        promessaId,
        veredito: 'nao_cumprida',
        justificativa: 'Mandato terminou sem nenhuma creche.',
        evidencias: [uuid()],
        fundamento: { tipo: 'mandato_encerrado' },
        propostoPor: uuid(),
      } as const;

      expect(erro(await proporVeredito.execute(entrada))).toBe('veredito.mandato_em_curso');

      mandatos.encerrar(valor(MandatoId.de(mandatoId)), ONTEM);
      valor(await proporVeredito.execute(entrada));
    });

    it('promessa de candidatura sem mandato não usa fim de mandato como fundamento', async () => {
      const promessaId = await registrar({
        ...entradaDeRegistro(),
        mandatoId: undefined,
        candidaturaId: uuid(),
      });
      const resultado = await new ProporVeredito(promessas, mandatos, relogio).execute({
        promessaId,
        veredito: 'nao_cumprida',
        justificativa: 'Não eleito.',
        evidencias: [uuid()],
        fundamento: { tipo: 'mandato_encerrado' },
        propostoPor: uuid(),
      });
      expect(erro(resultado)).toBe('veredito.promessa_sem_mandato');
    });

    it('ato em sentido contrário usa a captura informada', async () => {
      const promessaId = await registrar();
      const decreto = uuid();
      const resultado = await new ProporVeredito(promessas, mandatos, relogio).execute({
        promessaId,
        veredito: 'nao_cumprida',
        justificativa: 'Decreto revogou o programa prometido.',
        evidencias: [decreto],
        fundamento: { tipo: 'ato_em_sentido_contrario', evidenciaId: decreto },
        propostoPor: uuid(),
      });
      valor(resultado);
    });
  });

  describe('RecusarVeredito', () => {
    it('devolve a proposta e registra o motivo', async () => {
      const promessaId = await registrar();
      valor(
        await new ProporVeredito(promessas, mandatos, relogio).execute({
          promessaId,
          veredito: 'em_andamento',
          justificativa: 'Licitação aberta.',
          evidencias: [uuid()],
          propostoPor: uuid(),
        }),
      );

      valor(
        await new RecusarVeredito(promessas, relogio).execute({
          promessaId,
          recusadoPor: uuid(),
          motivo: 'A licitação foi anulada no dia seguinte.',
        }),
      );
      expect(promessas.tiposDosEventos().at(-1)).toBe('VereditoRecusado');
    });
  });
  describe('Reavaliação', () => {
    async function vincular(promessaId: string, idDoAlvo: string, confirmar: boolean) {
      const { vinculoId } = valor(
        await new SugerirVinculo(promessas, relogio).execute({
          promessaId,
          tipoDoAlvo: 'obra',
          idDoAlvo,
          estagioQueComprova: 'execucao',
          origem: 'curador',
          evidencias: [uuid()],
        }),
      );
      if (confirmar) {
        valor(
          await new ConfirmarVinculo(promessas, relogio).execute({
            promessaId,
            vinculoId,
            confirmadoPor: uuid(),
          }),
        );
      }
    }

    it('só as promessas com vínculo confirmado ao fato ganham pedido', async () => {
      const obra = uuid();
      const confirmada = await registrar();
      const sugerida = await registrar();
      const outra = await registrar();
      await vincular(confirmada, obra, true);
      await vincular(sugerida, obra, false);
      await vincular(outra, uuid(), true);
      const solicitar = new SolicitarReavaliacao(promessas, relogio);
      const fato = {
        tipoDoAlvo: 'obra',
        idDoAlvo: obra,
        motivo: 'A obra parou.',
        capturaId: uuid(),
      };

      expect(valor(await solicitar.execute(fato)).promessas).toEqual([confirmada]);
      expect(valor(await solicitar.execute(fato)).promessas).toEqual([]);
      expect(promessas.tiposDosEventos().filter((t) => t === 'ReavaliacaoSolicitada')).toHaveLength(
        1,
      );

      valor(
        await new ConcluirReavaliacao(promessas, relogio).execute({
          promessaId: confirmada,
          concluidaPor: uuid(),
        }),
      );
      expect(promessas.tiposDosEventos().at(-1)).toBe('ReavaliacaoConcluida');
    });

    it('recusa fato de tipo desconhecido', async () => {
      const resultado = await new SolicitarReavaliacao(promessas, relogio).execute({
        tipoDoAlvo: 'contrato',
        idDoAlvo: uuid(),
        motivo: 'Mudou.',
        capturaId: uuid(),
      });
      expect(erro(resultado)).toBe('entrada.opcao_invalida');
    });
  });
});
