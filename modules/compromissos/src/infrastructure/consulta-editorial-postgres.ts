import type {
  PromessaNaCuradoria,
  ResumoDePromessaNaCuradoria,
  VereditoNaCuradoria,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { desc, sql } from 'drizzle-orm';

import { PromessaId } from '../domain/identificadores.js';
import type { Promessa } from '../domain/promessa.js';
import type { PropostaDeVeredito } from '../domain/proposta-de-veredito.js';
import {
  pedidoDeReavaliacao,
  promessa,
  propostaDeVeredito,
  registroDeVeredito,
} from './esquema.js';
import type { PromessaRepositoryPostgres } from './promessa-repository-postgres.js';

/**
 * Leitura para o painel de curadoria. Não é a API pública (ADR-0008): o volume é pequeno e a equipe
 * precisa ver o agregado inteiro, então lê direto do modelo de escrita deste contexto.
 */
export class ConsultaEditorialPostgres {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly promessas: PromessaRepositoryPostgres,
  ) {}

  async listar(limite = 50): Promise<ResumoDePromessaNaCuradoria[]> {
    const vigente = sql<string | null>`(
      SELECT r.veredito FROM ${registroDeVeredito} r
      WHERE r.promessa_id = ${promessa.id}
      ORDER BY r.publicado_em DESC, r.id DESC LIMIT 1
    )`;
    const pendente = sql<boolean>`EXISTS (
      SELECT 1 FROM ${propostaDeVeredito} p WHERE p.promessa_id = ${promessa.id}
    )`;
    const reavaliacoes = sql<number>`(
      SELECT count(*)::int FROM ${pedidoDeReavaliacao} q WHERE q.promessa_id = ${promessa.id}
    )`;
    const linhas = await this.banco.drizzle
      .select({
        promessaId: promessa.id,
        pessoaId: promessa.pessoaId,
        texto: promessa.texto,
        estagio: promessa.estagio,
        vigente,
        pendente,
        reavaliacoes,
      })
      .from(promessa)
      .orderBy(desc(promessa.id))
      .limit(limite);
    return linhas.map((l) => ({
      promessaId: l.promessaId,
      pessoaId: l.pessoaId,
      texto: l.texto,
      estagio: l.estagio,
      vereditoVigente: l.vigente ?? 'nao_iniciada',
      aguardandoRevisao: l.pendente,
      reavaliacoesPendentes: l.reavaliacoes,
    }));
  }

  async buscar(promessaId: string): Promise<PromessaNaCuradoria | undefined> {
    const id = PromessaId.de(promessaId);
    if (!id.ok) return undefined;
    const encontrada = await this.promessas.buscarPorId(id.value);
    return encontrada && paraCuradoria(encontrada);
  }
}

function paraCuradoria(p: Promessa): PromessaNaCuradoria {
  return {
    promessaId: p.id.valor,
    pessoaId: p.autor.pessoa.valor,
    candidaturaId: p.autor.candidatura?.valor ?? null,
    mandatoId: p.autor.mandato?.valor ?? null,
    texto: p.texto.valor,
    tema: p.tema.codigo,
    mensurabilidade: p.mensurabilidade,
    competencia: p.competencia,
    meta: p.meta
      ? { descricao: p.meta.descricao, prazo: p.meta.prazo?.toISOString() ?? null }
      : null,
    estagio: p.estagio,
    vereditoVigente: p.vereditoVigente,
    aguardandoRevisao: p.propostaPendente !== undefined,
    fontes: p.fontes.map((f) => ({
      fonteId: f.id.valor,
      tipo: f.tipo,
      capturaId: f.captura.valor,
      citacaoLiteral: f.trecho.citacaoLiteral,
      localizacao: f.trecho.localizacao,
      dataDaDeclaracao: f.dataDaDeclaracao.toISOString(),
    })),
    vinculos: p.vinculos.map((v) => ({
      vinculoId: v.id.valor,
      tipoDoAlvo: v.alvo.tipo,
      idDoAlvo: v.alvo.id.valor,
      estagioQueComprova: v.estagioQueComprova,
      origem: v.origem,
      situacao: v.situacao,
      evidencias: v.evidencias.map((e) => e.valor),
    })),
    historico: p.historicoDeVereditos.map((r) => ({
      ...paraVeredito(r.propostaPublicada),
      registroId: r.id.valor,
      revisadoPor: r.revisadoPor.valor,
      publicadoEm: r.publicadoEm.toISOString(),
      corrige: r.corrige?.valor ?? null,
    })),
    propostaPendente: p.propostaPendente ? paraVeredito(p.propostaPendente) : null,
    reavaliacoesPendentes: p.reavaliacoesPendentes.length,
    reavaliacoes: p.reavaliacoesPendentes.map((r) => ({
      tipoDoAlvo: r.alvo.tipo,
      idDoAlvo: r.alvo.id.valor,
      motivo: r.motivo,
      capturaId: r.captura.valor,
      pedidoEm: r.pedidoEm.toISOString(),
    })),
  };
}

function paraVeredito(proposta: PropostaDeVeredito): VereditoNaCuradoria {
  return {
    veredito: proposta.veredito,
    justificativa: proposta.justificativa,
    evidencias: proposta.evidencias.map((e) => e.valor),
    fundamento: proposta.fundamento?.tipo ?? null,
    errata: proposta.ehErrata,
    propostoPor: proposta.propostoPor.valor,
    propostoEm: proposta.propostoEm.toISOString(),
  };
}
