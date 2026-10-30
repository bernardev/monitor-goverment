import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { and, eq } from 'drizzle-orm';

import type { ProposicaoRepository } from '../application/portas.js';
import { CASAS_LEGISLATIVAS, type CasaLegislativa } from '../domain/casa-legislativa.js';
import { CapturaId, PessoaId, ProposicaoId } from '../domain/identificadores.js';
import { Proposicao, TIPOS_DE_PROPOSICAO } from '../domain/proposicao.js';
import { outbox, proposicao } from './esquema.js';
import { ConflitoDeConcorrencia, confiavel, conhecido } from './persistencia.js';

export class ProposicaoRepositoryPostgres implements ProposicaoRepository {
  /** Versão lida de cada proposição carregada por este repositório. */
  private readonly versoes = new WeakMap<Proposicao, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(casa: CasaLegislativa, codigoNaFonte: string): Promise<Proposicao | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(proposicao)
      .where(and(eq(proposicao.casa, casa), eq(proposicao.codigoNaFonte, codigoNaFonte)));
    if (!linha) return undefined;
    const encontrada = paraProposicao(linha);
    this.versoes.set(encontrada, linha.versao);
    return encontrada;
  }

  salvar(alvo: Proposicao): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const a = alvo.apuracao;
      const dados = {
        sigla: a.sigla,
        numero: a.numero,
        ano: a.ano,
        ementa: a.ementa,
        apresentadaEm: a.apresentadaEm,
        autores: a.autores.map((autor) => ({
          pessoaId: autor.pessoa?.valor ?? null,
          nomeNaFonte: autor.nomeNaFonte,
          tipoNaFonte: autor.tipoNaFonte,
          proponente: autor.proponente,
        })),
        situacao: a.situacao
          ? {
              descricao: a.situacao.descricao,
              desde: a.situacao.desde.toISOString(),
              orgao: a.situacao.orgao,
            }
          : null,
        tramitacoes: a.tramitacoes.map((t) => ({
          em: t.em.toISOString(),
          orgao: t.orgao,
          descricao: t.descricao,
          situacao: t.situacao,
          despacho: t.despacho,
        })),
        normaGerada: a.normaGerada,
        urlDoTexto: a.urlDoTexto,
        capturaId: alvo.captura.valor,
      };
      if (versaoLida === undefined) {
        await tx.insert(proposicao).values({
          id: alvo.id.valor,
          casa: alvo.casa,
          codigoNaFonte: alvo.codigoNaFonte,
          ...dados,
          versao: 1,
        });
      } else {
        const atualizadas = await tx
          .update(proposicao)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(and(eq(proposicao.id, alvo.id.valor), eq(proposicao.versao, versaoLida)))
          .returning({ id: proposicao.id });
        if (atualizadas.length === 0) {
          throw new ConflitoDeConcorrencia(`A proposição ${alvo.id.valor}`);
        }
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraProposicao(linha: typeof proposicao.$inferSelect): Proposicao {
  return Proposicao.reconstituir(confiavel(ProposicaoId.de(linha.id)), {
    casa: conhecido(CASAS_LEGISLATIVAS, linha.casa, 'casa'),
    codigoNaFonte: linha.codigoNaFonte,
    apuracao: {
      sigla: conhecido(TIPOS_DE_PROPOSICAO, linha.sigla, 'sigla da proposição'),
      numero: linha.numero,
      ano: linha.ano,
      ementa: linha.ementa,
      apresentadaEm: linha.apresentadaEm,
      autores: linha.autores.map((autor) => ({
        pessoa: autor.pessoaId === null ? undefined : confiavel(PessoaId.de(autor.pessoaId)),
        nomeNaFonte: autor.nomeNaFonte,
        tipoNaFonte: autor.tipoNaFonte,
        proponente: autor.proponente,
      })),
      situacao: linha.situacao
        ? {
            descricao: linha.situacao.descricao,
            desde: new Date(linha.situacao.desde),
            orgao: linha.situacao.orgao,
          }
        : null,
      tramitacoes: linha.tramitacoes.map((t) => ({
        em: new Date(t.em),
        orgao: t.orgao,
        descricao: t.descricao,
        situacao: t.situacao,
        despacho: t.despacho,
      })),
      normaGerada: linha.normaGerada,
      urlDoTexto: linha.urlDoTexto,
    },
    captura: confiavel(CapturaId.de(linha.capturaId)),
  });
}
