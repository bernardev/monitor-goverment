import type { VotacaoNominalPublicada } from '@prometeu/atividade-legislativa';
import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq, lte } from 'drizzle-orm';

import { votacao, voto } from './esquema.js';

/** Eventos que esta projeção acompanha. Todos trazem o estado completo da votação. */
export const EVENTOS_DE_VOTACAO = ['VotacaoNominalRegistrada', 'VotacaoNominalRetificada'] as const;

/**
 * Mantém as projeções `votacao` e `voto` a partir dos eventos de Atividade Legislativa. Vale o evento
 * mais novo: a ordem de chegada não importa, e reaplicar o mesmo evento não muda nada.
 */
export class ProjetorDeVotacoes {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as VotacaoNominalPublicada;
    const votacaoId = envelope.idDoAgregado;
    const placar: Record<string, number> = {};
    for (const { opcao } of dados.votos) placar[opcao] = (placar[opcao] ?? 0) + 1;
    const estado = {
      casa: dados.casa,
      codigoNaFonte: dados.codigoNaFonte,
      dia: dados.dia,
      registradaEm: new Date(dados.registradaEm),
      descricao: dados.descricao,
      resultado: dados.resultado,
      secreta: dados.secreta,
      proposicoes: dados.proposicoes,
      placar,
      capturaId: dados.capturaId,
      capturaDosVotosId: dados.capturaDosVotosId,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    const aplicada = await this.banco.executor
      .insert(votacao)
      .values({ votacaoId, ...estado })
      .onConflictDoUpdate({
        target: votacao.votacaoId,
        set: estado,
        setWhere: lte(votacao.ocorridoEm, estado.ocorridoEm),
      })
      .returning({ votacaoId: votacao.votacaoId });
    // Evento mais velho do que o já aplicado: os votos também ficam como estão.
    if (aplicada.length === 0) return;

    await this.banco.executor.delete(voto).where(eq(voto.votacaoId, votacaoId));
    await this.banco.executor.insert(voto).values(
      dados.votos.map((v) => ({
        votacaoId,
        pessoaId: v.pessoaId,
        opcao: v.opcao,
        registroNaFonte: v.registroNaFonte,
        siglaPartidoNaFonte: v.siglaPartidoNaFonte,
      })),
    );
  }
}
