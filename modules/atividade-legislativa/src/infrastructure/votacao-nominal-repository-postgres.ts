import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { and, eq } from 'drizzle-orm';

import type { VotacaoNominalRepository } from '../application/portas.js';
import { CASAS_LEGISLATIVAS, type CasaLegislativa } from '../domain/casa-legislativa.js';
import { DiaDeSessao } from '../domain/dia-de-sessao.js';
import { MotivoDaAusencia } from '../domain/motivo-da-ausencia.js';
import { CapturaId, MandatoId, PessoaId, VotacaoNominalId } from '../domain/identificadores.js';
import { VotacaoNominal } from '../domain/votacao-nominal.js';
import { OPCOES_DE_VOTO, RESULTADOS_DA_VOTACAO, SITUACOES_SEM_VOTO } from '../domain/voto.js';
import { outbox, votacaoNominal } from './esquema.js';
import { ConflitoDeConcorrencia, confiavel, conhecido } from './persistencia.js';

export class VotacaoNominalRepositoryPostgres implements VotacaoNominalRepository {
  /** Versão lida de cada votação carregada por este repositório. */
  private readonly versoes = new WeakMap<VotacaoNominal, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(casa: CasaLegislativa, codigoNaFonte: string): Promise<VotacaoNominal | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(votacaoNominal)
      .where(and(eq(votacaoNominal.casa, casa), eq(votacaoNominal.codigoNaFonte, codigoNaFonte)));
    if (!linha) return undefined;
    const encontrada = paraVotacao(linha);
    this.versoes.set(encontrada, linha.versao);
    return encontrada;
  }

  salvar(alvo: VotacaoNominal): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const dados = {
        dia: alvo.dia.valor,
        registradaEm: alvo.registradaEm,
        descricao: alvo.descricao,
        resultado: alvo.resultado,
        proposicoes: alvo.proposicoes.map((p) => ({ ...p })),
        votos: alvo.votos.map((v) => ({
          pessoaId: v.pessoa.valor,
          mandatoId: v.mandato.valor,
          opcao: v.opcao,
          registroNaFonte: v.registroNaFonte,
          registradoEm: v.registradoEm?.toISOString() ?? null,
          siglaPartidoNaFonte: v.siglaPartidoNaFonte,
        })),
        relacaoCompleta: alvo.relacaoCompleta,
        semVoto: alvo.semVoto.map((s) => ({
          pessoaId: s.pessoa.valor,
          mandatoId: s.mandato.valor,
          situacao: s.situacao,
          motivoCategoria: s.motivo?.categoria ?? null,
          motivoDescricao: s.motivo?.descricaoNaFonte ?? null,
          registroNaFonte: s.registroNaFonte,
          siglaPartidoNaFonte: s.siglaPartidoNaFonte,
        })),
        capturaId: alvo.captura.valor,
        capturaDosVotosId: alvo.capturaDosVotos.valor,
      };
      if (versaoLida === undefined) {
        await tx.insert(votacaoNominal).values({
          id: alvo.id.valor,
          casa: alvo.casa,
          codigoNaFonte: alvo.codigoNaFonte,
          ...dados,
          versao: 1,
        });
      } else {
        const atualizadas = await tx
          .update(votacaoNominal)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(and(eq(votacaoNominal.id, alvo.id.valor), eq(votacaoNominal.versao, versaoLida)))
          .returning({ id: votacaoNominal.id });
        if (atualizadas.length === 0) {
          throw new ConflitoDeConcorrencia(`A votação nominal ${alvo.id.valor}`);
        }
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraVotacao(linha: typeof votacaoNominal.$inferSelect): VotacaoNominal {
  return VotacaoNominal.reconstituir(confiavel(VotacaoNominalId.de(linha.id)), {
    casa: conhecido(CASAS_LEGISLATIVAS, linha.casa, 'casa'),
    codigoNaFonte: linha.codigoNaFonte,
    dia: confiavel(DiaDeSessao.de(linha.dia)),
    registradaEm: linha.registradaEm,
    descricao: linha.descricao,
    resultado: conhecido(RESULTADOS_DA_VOTACAO, linha.resultado, 'resultado'),
    proposicoes: linha.proposicoes,
    votos: linha.votos.map((v) => ({
      pessoa: confiavel(PessoaId.de(v.pessoaId)),
      mandato: confiavel(MandatoId.de(v.mandatoId)),
      opcao: conhecido(OPCOES_DE_VOTO, v.opcao, 'opção de voto'),
      registroNaFonte: v.registroNaFonte,
      registradoEm: v.registradoEm === null ? null : new Date(v.registradoEm),
      siglaPartidoNaFonte: v.siglaPartidoNaFonte,
    })),
    relacaoCompleta: linha.relacaoCompleta,
    semVoto: linha.semVoto.map((s) => ({
      pessoa: confiavel(PessoaId.de(s.pessoaId)),
      mandato: confiavel(MandatoId.de(s.mandatoId)),
      situacao: conhecido(SITUACOES_SEM_VOTO, s.situacao, 'situação sem voto'),
      motivo:
        s.motivoCategoria === null
          ? undefined
          : confiavel(MotivoDaAusencia.criar(s.motivoCategoria, s.motivoDescricao ?? '')),
      registroNaFonte: s.registroNaFonte,
      siglaPartidoNaFonte: s.siglaPartidoNaFonte,
    })),
    captura: confiavel(CapturaId.de(linha.capturaId)),
    capturaDosVotos: confiavel(CapturaId.de(linha.capturaDosVotosId)),
  });
}
