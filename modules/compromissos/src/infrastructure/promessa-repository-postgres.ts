import { type BancoDoContexto, type Executor, gravarNaOutbox } from '@prometeu/infraestrutura';
import type { DomainError, Result } from '@prometeu/shared-kernel';
import { and, asc, eq } from 'drizzle-orm';

import type { PromessaRepository } from '../application/portas.js';
import { AutorDaPromessa } from '../domain/autor-da-promessa.js';
import { COMPETENCIAS, MENSURABILIDADES, TIPOS_DE_FONTE } from '../domain/classificacao.js';
import { ESTAGIOS, type EstagioComprovavel } from '../domain/estagio.js';
import { FonteDaPromessa } from '../domain/fonte-da-promessa.js';
import {
  CandidaturaId,
  CapturaId,
  CuradorId,
  FonteId,
  IdDoAlvo,
  MandatoId,
  PessoaId,
  PromessaId,
  RegistroDeVereditoId,
  VinculoId,
} from '../domain/identificadores.js';
import { Meta } from '../domain/meta.js';
import { Promessa } from '../domain/promessa.js';
import {
  type FundamentoDeNaoCumprimento,
  PropostaDeVeredito,
} from '../domain/proposta-de-veredito.js';
import { ReferenciaExterna, TIPOS_DE_ALVO } from '../domain/referencia-externa.js';
import { RegistroDeVeredito } from '../domain/registro-de-veredito.js';
import { Tema } from '../domain/tema.js';
import { TextoCanonico } from '../domain/texto-canonico.js';
import { Trecho } from '../domain/trecho.js';
import { VEREDITOS } from '../domain/veredito.js';
import { ORIGENS_DE_VINCULO, type SituacaoDoVinculo, Vinculo } from '../domain/vinculo.js';
import {
  type FundamentoGravado,
  fonte,
  outbox,
  promessa,
  propostaDeVeredito,
  registroDeVeredito,
  vinculo,
} from './esquema.js';

/** Outra gravação mudou a promessa entre a leitura e a escrita. */
export class ConflitoDeConcorrencia extends Error {
  constructor(promessaId: string) {
    super(`A promessa ${promessaId} foi alterada por outra gravação. Recarregue e tente de novo.`);
  }
}

const SITUACOES: readonly SituacaoDoVinculo[] = ['sugerido', 'confirmado', 'rejeitado'];

/**
 * Grava o agregado `Promessa` em tabelas do schema `compromissos`. Fontes e registros de veredito só
 * são inseridos (são imutáveis); vínculos são regravados porque mudam de situação; a proposta
 * pendente é substituída. Tudo numa transação, com os eventos na outbox (ADR-0007).
 */
export class PromessaRepositoryPostgres implements PromessaRepository {
  private readonly versoes = new WeakMap<Promessa, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscarPorId(id: PromessaId): Promise<Promessa | undefined> {
    const executor = this.banco.executor;
    const [raiz] = await executor.select().from(promessa).where(eq(promessa.id, id.valor));
    if (!raiz) return undefined;

    const [fontes, vinculos, registros, [proposta]] = await Promise.all([
      executor.select().from(fonte).where(eq(fonte.promessaId, raiz.id)).orderBy(asc(fonte.id)),
      executor
        .select()
        .from(vinculo)
        .where(eq(vinculo.promessaId, raiz.id))
        .orderBy(asc(vinculo.id)),
      executor
        .select()
        .from(registroDeVeredito)
        .where(eq(registroDeVeredito.promessaId, raiz.id))
        .orderBy(asc(registroDeVeredito.publicadoEm), asc(registroDeVeredito.id)),
      executor.select().from(propostaDeVeredito).where(eq(propostaDeVeredito.promessaId, raiz.id)),
    ]);

    const encontrada = Promessa.reconstituir(confiavel(PromessaId.de(raiz.id)), {
      autor: confiavel(
        AutorDaPromessa.criar({
          pessoa: confiavel(PessoaId.de(raiz.pessoaId)),
          candidatura: opcional(raiz.candidaturaId, CandidaturaId.de),
          mandato: opcional(raiz.mandatoId, MandatoId.de),
        }),
      ),
      texto: confiavel(TextoCanonico.criar(raiz.texto)),
      tema: confiavel(Tema.criar(raiz.tema)),
      mensurabilidade: daLista(MENSURABILIDADES, raiz.mensurabilidade),
      competencia: daLista(COMPETENCIAS, raiz.competencia),
      meta:
        raiz.metaDescricao === null
          ? undefined
          : confiavel(Meta.criar(raiz.metaDescricao, raiz.metaPrazo ?? undefined)),
      fontes: fontes.map(paraFonte),
      vinculos: vinculos.map(paraVinculo),
      historico: registros.map(paraRegistro),
      proposta: proposta ? paraProposta(proposta) : undefined,
      estagio: daLista(ESTAGIOS, raiz.estagio),
    });
    this.versoes.set(encontrada, raiz.versao);
    return encontrada;
  }

  salvar(alvo: Promessa): Promise<void> {
    return this.banco.transacao(async (tx) => {
      await this.gravarRaiz(tx, alvo);
      const promessaId = alvo.id.valor;

      if (alvo.fontes.length > 0) {
        await tx
          .insert(fonte)
          .values(
            alvo.fontes.map((f) => ({
              id: f.id.valor,
              promessaId,
              tipo: f.tipo,
              capturaId: f.captura.valor,
              citacaoLiteral: f.trecho.citacaoLiteral,
              localizacao: f.trecho.localizacao,
              dataDaDeclaracao: f.dataDaDeclaracao,
            })),
          )
          .onConflictDoNothing();
      }

      for (const v of alvo.vinculos) {
        const linha = {
          id: v.id.valor,
          promessaId,
          tipoDoAlvo: v.alvo.tipo,
          idDoAlvo: v.alvo.id.valor,
          estagioQueComprova: v.estagioQueComprova,
          origem: v.origem,
          evidencias: v.evidencias.map((e) => e.valor),
          situacao: v.situacao,
          sugeridoEm: v.sugeridoEm,
          decididoPor: v.decisao?.por.valor ?? null,
          decididoEm: v.decisao?.em ?? null,
          motivo: v.decisao?.motivo ?? null,
        };
        await tx
          .insert(vinculo)
          .values(linha)
          .onConflictDoUpdate({
            target: vinculo.id,
            set: {
              situacao: linha.situacao,
              decididoPor: linha.decididoPor,
              decididoEm: linha.decididoEm,
              motivo: linha.motivo,
            },
          });
      }

      if (alvo.historicoDeVereditos.length > 0) {
        await tx
          .insert(registroDeVeredito)
          .values(
            alvo.historicoDeVereditos.map((r) => ({
              id: r.id.valor,
              promessaId,
              ...colunasDaProposta(r.propostaPublicada),
              revisadoPor: r.revisadoPor.valor,
              publicadoEm: r.publicadoEm,
              corrige: r.corrige?.valor ?? null,
            })),
          )
          .onConflictDoNothing();
      }

      await tx.delete(propostaDeVeredito).where(eq(propostaDeVeredito.promessaId, promessaId));
      const pendente = alvo.propostaPendente;
      if (pendente) {
        await tx.insert(propostaDeVeredito).values({ promessaId, ...colunasDaProposta(pendente) });
      }

      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }

  private async gravarRaiz(tx: Executor, alvo: Promessa): Promise<void> {
    const versaoLida = this.versoes.get(alvo);
    const dados = {
      pessoaId: alvo.autor.pessoa.valor,
      candidaturaId: alvo.autor.candidatura?.valor ?? null,
      mandatoId: alvo.autor.mandato?.valor ?? null,
      texto: alvo.texto.valor,
      tema: alvo.tema.codigo,
      mensurabilidade: alvo.mensurabilidade,
      competencia: alvo.competencia,
      metaDescricao: alvo.meta?.descricao ?? null,
      metaPrazo: alvo.meta?.prazo ?? null,
      estagio: alvo.estagio,
    };
    if (versaoLida === undefined) {
      await tx.insert(promessa).values({ id: alvo.id.valor, ...dados, versao: 1 });
    } else {
      const atualizadas = await tx
        .update(promessa)
        .set({ ...dados, versao: versaoLida + 1 })
        .where(and(eq(promessa.id, alvo.id.valor), eq(promessa.versao, versaoLida)))
        .returning({ id: promessa.id });
      if (atualizadas.length === 0) throw new ConflitoDeConcorrencia(alvo.id.valor);
    }
    this.versoes.set(alvo, (versaoLida ?? 0) + 1);
  }
}

function colunasDaProposta(proposta: PropostaDeVeredito) {
  return {
    veredito: proposta.veredito,
    justificativa: proposta.justificativa,
    evidencias: proposta.evidencias.map((e) => e.valor),
    fundamento: gravarFundamento(proposta.fundamento),
    errata: proposta.ehErrata,
    propostoPor: proposta.propostoPor.valor,
    propostoEm: proposta.propostoEm,
  };
}

function gravarFundamento(
  fundamento: FundamentoDeNaoCumprimento | undefined,
): FundamentoGravado | null {
  if (!fundamento) return null;
  return fundamento.tipo === 'mandato_encerrado'
    ? { tipo: 'mandato_encerrado', encerradoEm: fundamento.encerradoEm.toISOString() }
    : { tipo: 'ato_em_sentido_contrario', evidencia: fundamento.evidencia.valor };
}

function lerFundamento(gravado: FundamentoGravado | null): FundamentoDeNaoCumprimento | undefined {
  if (gravado === null) return undefined;
  return gravado.tipo === 'mandato_encerrado'
    ? { tipo: 'mandato_encerrado', encerradoEm: new Date(gravado.encerradoEm) }
    : { tipo: 'ato_em_sentido_contrario', evidencia: confiavel(CapturaId.de(gravado.evidencia)) };
}

type LinhaDeProposta = typeof propostaDeVeredito.$inferSelect;

function paraProposta(linha: Omit<LinhaDeProposta, 'promessaId'>): PropostaDeVeredito {
  return PropostaDeVeredito.reconstituir({
    veredito: daLista(VEREDITOS, linha.veredito),
    justificativa: linha.justificativa,
    evidencias: linha.evidencias.map((e) => confiavel(CapturaId.de(e))),
    fundamento: lerFundamento(linha.fundamento),
    errata: linha.errata,
    propostoPor: confiavel(CuradorId.de(linha.propostoPor)),
    propostoEm: linha.propostoEm,
  });
}

function paraRegistro(linha: typeof registroDeVeredito.$inferSelect): RegistroDeVeredito {
  return RegistroDeVeredito.reconstituir(
    confiavel(RegistroDeVereditoId.de(linha.id)),
    paraProposta(linha),
    {
      revisadoPor: confiavel(CuradorId.de(linha.revisadoPor)),
      publicadoEm: linha.publicadoEm,
      corrige: opcional(linha.corrige, RegistroDeVereditoId.de),
    },
  );
}

function paraFonte(linha: typeof fonte.$inferSelect): FonteDaPromessa {
  return FonteDaPromessa.reconstituir(confiavel(FonteId.de(linha.id)), {
    tipo: daLista(TIPOS_DE_FONTE, linha.tipo),
    captura: confiavel(CapturaId.de(linha.capturaId)),
    trecho: confiavel(Trecho.criar(linha.citacaoLiteral, linha.localizacao)),
    dataDaDeclaracao: linha.dataDaDeclaracao,
  });
}

function paraVinculo(linha: typeof vinculo.$inferSelect): Vinculo {
  const decisao =
    linha.decididoPor !== null && linha.decididoEm !== null
      ? {
          por: confiavel(CuradorId.de(linha.decididoPor)),
          em: linha.decididoEm,
          motivo: linha.motivo ?? undefined,
        }
      : undefined;
  return Vinculo.reconstituir(confiavel(VinculoId.de(linha.id)), {
    alvo: ReferenciaExterna.criar(
      daLista(TIPOS_DE_ALVO, linha.tipoDoAlvo),
      confiavel(IdDoAlvo.de(linha.idDoAlvo)),
    ),
    estagioQueComprova: daLista(ESTAGIOS, linha.estagioQueComprova) as EstagioComprovavel,
    origem: daLista(ORIGENS_DE_VINCULO, linha.origem),
    evidencias: linha.evidencias.map((e) => confiavel(CapturaId.de(e))),
    situacao: daLista(SITUACOES, linha.situacao),
    sugeridoEm: linha.sugeridoEm,
    decisao,
  });
}

// O banco só guarda o que o domínio validou; um valor fora do lugar aqui é dado corrompido.

function confiavel<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`Dado corrompido em compromissos: ${resultado.error.message}`);
  return resultado.value;
}

function opcional<T>(
  valor: string | null,
  fabrica: (valor: string) => Result<T, DomainError>,
): T | undefined {
  return valor === null ? undefined : confiavel(fabrica(valor));
}

function daLista<T extends string>(opcoes: readonly T[], valor: string): T {
  const encontrado = opcoes.find((opcao) => opcao === valor);
  if (encontrado === undefined) throw new Error(`Valor desconhecido em compromissos: ${valor}`);
  return encontrado;
}
