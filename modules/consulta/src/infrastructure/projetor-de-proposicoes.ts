import type { ProposicaoPublicada } from '@prometeu/atividade-legislativa';
import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq, lte } from 'drizzle-orm';

import { autoria, proposicao } from './esquema.js';

/** Eventos que esta projeção acompanha. Todos trazem o estado completo da proposição. */
export const EVENTOS_DE_PROPOSICAO = [
  'ProposicaoRegistrada',
  'TramitacaoAvancou',
  'ProposicaoRetificada',
] as const;

/**
 * Mantém as projeções `proposicao` e `autoria` a partir dos eventos de Atividade Legislativa. Vale
 * o evento mais novo: a ordem de chegada não importa, e reaplicar o mesmo evento não muda nada.
 */
export class ProjetorDeProposicoes {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as ProposicaoPublicada;
    const proposicaoId = envelope.idDoAgregado;
    const ultima = dados.tramitacoes.at(-1);
    const estado = {
      casa: dados.casa,
      codigoNaFonte: dados.codigoNaFonte,
      sigla: dados.sigla,
      numero: dados.numero,
      ano: dados.ano,
      ementa: dados.ementa,
      apresentadaEm: dados.apresentadaEm === null ? null : new Date(dados.apresentadaEm),
      situacao: dados.situacao,
      ultimaTramitacaoEm: ultima ? new Date(ultima.em) : null,
      normaGerada: dados.normaGerada,
      urlDoTexto: dados.urlDoTexto,
      autores: dados.autores,
      tramitacoes: dados.tramitacoes,
      capturaId: dados.capturaId,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    const aplicada = await this.banco.executor
      .insert(proposicao)
      .values({ proposicaoId, ...estado })
      .onConflictDoUpdate({
        target: proposicao.proposicaoId,
        set: estado,
        setWhere: lte(proposicao.ocorridoEm, estado.ocorridoEm),
      })
      .returning({ proposicaoId: proposicao.proposicaoId });
    // Evento mais velho do que o já aplicado: a autoria também fica como está.
    if (aplicada.length === 0) return;

    await this.banco.executor.delete(autoria).where(eq(autoria.proposicaoId, proposicaoId));
    const autores = dados.autores.flatMap((a) =>
      a.pessoaId === null ? [] : [{ proposicaoId, pessoaId: a.pessoaId, proponente: a.proponente }],
    );
    if (autores.length > 0) await this.banco.executor.insert(autoria).values(autores);
  }
}
