import type { VotacaoNominalPublicada } from '@prometeu/atividade-legislativa';
import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq, lte } from 'drizzle-orm';

import { votacao, voto } from './esquema.js';

/** Eventos que esta projeção acompanha. Todos trazem o estado completo da votação. */
export const EVENTOS_DE_VOTACAO = ['VotacaoNominalRegistrada', 'VotacaoNominalRetificada'] as const;

/**
 * Os dados da v1 do contrato, que não tinha quem não votou: a Câmara, a única casa até então, não
 * lista quem não votou.
 */
type DadosDaVotacao = Omit<VotacaoNominalPublicada, 'relacaoCompleta' | 'semVoto'> &
  Partial<Pick<VotacaoNominalPublicada, 'relacaoCompleta' | 'semVoto'>>;

/**
 * Mantém as projeções `votacao` e `voto` a partir dos eventos de Atividade Legislativa (v1 e v2).
 * Vale o evento mais novo: a ordem de chegada não importa, e reaplicar o mesmo evento não muda nada.
 */
export class ProjetorDeVotacoes {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as DadosDaVotacao;
    const semVoto = dados.semVoto ?? [];
    const votacaoId = envelope.idDoAgregado;
    const estado = {
      casa: dados.casa,
      codigoNaFonte: dados.codigoNaFonte,
      dia: dados.dia,
      registradaEm: dados.registradaEm === null ? null : new Date(dados.registradaEm),
      descricao: dados.descricao,
      resultado: dados.resultado,
      secreta: dados.secreta,
      relacaoCompleta: dados.relacaoCompleta ?? false,
      proposicoes: dados.proposicoes,
      placar: contar(dados.votos.map((v) => v.opcao)),
      contagemSemVoto: contar(semVoto.map((s) => s.situacao)),
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
    await this.banco.executor.insert(voto).values([
      ...dados.votos.map((v) => ({
        votacaoId,
        pessoaId: v.pessoaId,
        opcao: v.opcao,
        registroNaFonte: v.registroNaFonte,
        siglaPartidoNaFonte: v.siglaPartidoNaFonte,
      })),
      ...semVoto.map((s) => ({
        votacaoId,
        pessoaId: s.pessoaId,
        situacaoSemVoto: s.situacao,
        motivoCategoria: s.motivo?.categoria ?? null,
        motivoDescricao: s.motivo?.descricaoNaFonte ?? null,
        registroNaFonte: s.registroNaFonte,
        siglaPartidoNaFonte: s.siglaPartidoNaFonte,
      })),
    ]);
  }
}

function contar(valores: readonly string[]): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const valor of valores) contagem[valor] = (contagem[valor] ?? 0) + 1;
  return contagem;
}
