import type { EnvelopeDeEvento } from '@prometeu/contracts';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  consumidorIdempotente,
} from '@prometeu/infraestrutura';

import type { FatoQueMudou, SolicitarReavaliacao } from '../application/casos-de-uso/reavaliar.js';
import { inbox } from '../infrastructure/esquema.js';

export const CONSUMIDOR_DE_REAVALIACAO = 'compromissos.reavaliar_promessas';

/** Os fatos de outros contextos cuja mudança pode mexer no que a curadoria já decidiu. */
export const EVENTOS_QUE_PEDEM_REAVALIACAO = [
  'ExecucaoDaEmendaAtualizada',
  'ObraParalisada',
  'ObraAtualizada',
  'TramitacaoAvancou',
] as const;

const SITUACOES_FINAIS_DA_OBRA: Readonly<Record<string, string>> = {
  concluida: 'concluída',
  cancelada: 'cancelada',
  inacabada: 'inacabada',
};

interface Destinacao {
  readonly pagoCentavos: string;
  readonly restosPagosCentavos: string;
}

interface Tramitacao {
  readonly descricao: string;
}

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function reais(centavos: bigint): string {
  return REAIS.format(Number(centavos) / 100).replace(/\s/g, ' ');
}

/** `2026-09-21` → `21/09/2026`. */
function data(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia ?? ''}/${mes ?? ''}/${ano ?? ''}`;
}

/**
 * Traduz o evento de outro contexto para a linguagem de Compromissos: qual fato mudou e o que mudou,
 * em uma frase. Devolve `undefined` quando a mudança não interessa à curadoria (a obra só mediu
 * mais um pouco, por exemplo).
 */
export function fatoQueMudou(envelope: EnvelopeDeEvento): FatoQueMudou | undefined {
  const dados = envelope.dados;
  const capturaId = String(dados['capturaId']);
  const idDoAlvo = envelope.idDoAgregado;
  switch (envelope.tipo) {
    case 'ExecucaoDaEmendaAtualizada': {
      const destinacoes = dados['destinacoes'] as readonly Destinacao[];
      const pago = destinacoes.reduce(
        (soma, d) => soma + BigInt(d.pagoCentavos) + BigInt(d.restosPagosCentavos),
        0n,
      );
      return {
        tipoDoAlvo: 'emenda',
        idDoAlvo,
        motivo: `A execução da emenda ${String(dados['numero'])}/${String(dados['ano'])} mudou: ${reais(pago)} pagos até agora.`,
        capturaId,
      };
    }
    case 'ObraParalisada': {
      const em = dados['em'] as string | null;
      const justificativa = dados['justificativa'] as string | null;
      return {
        tipoDoAlvo: 'obra',
        idDoAlvo,
        motivo: [
          em ? `A obra foi paralisada em ${data(em)}.` : 'A obra foi paralisada.',
          justificativa ? `Justificativa: ${justificativa}` : '',
        ]
          .filter(Boolean)
          .join(' '),
        capturaId,
      };
    }
    case 'ObraAtualizada': {
      const situacao = SITUACOES_FINAIS_DA_OBRA[String(dados['situacao'])];
      if (!situacao) return undefined;
      return {
        tipoDoAlvo: 'obra',
        idDoAlvo,
        motivo: `A obra consta como ${situacao} na fonte (${String(dados['situacaoNaFonte'])}).`,
        capturaId,
      };
    }
    case 'TramitacaoAvancou': {
      const tramitacoes = dados['tramitacoes'] as readonly Tramitacao[];
      const ultima = tramitacoes.at(-1)?.descricao;
      const nome = `${String(dados['sigla'])} ${String(dados['numero'])}/${String(dados['ano'])}`;
      return {
        tipoDoAlvo: 'proposicao',
        idDoAlvo,
        motivo: ultima ? `O ${nome} tramitou: ${ultima}` : `O ${nome} tramitou.`,
        capturaId,
      };
    }
    default:
      return undefined;
  }
}

/**
 * Política da reavaliação (ADR-0010): quando um fato ligado a promessas muda, cada promessa com
 * vínculo confirmado com ele ganha um pedido para a curadoria olhar de novo. Nada mais muda sozinho.
 */
export async function assinarConsumidores(
  barramento: BarramentoDeEventos,
  banco: BancoDoContexto,
  solicitarReavaliacao: SolicitarReavaliacao,
): Promise<void> {
  const consumir = consumidorIdempotente(
    banco,
    inbox,
    CONSUMIDOR_DE_REAVALIACAO,
    async (envelope) => {
      const fato = fatoQueMudou(envelope);
      if (!fato) return;
      const resultado = await solicitarReavaliacao.execute(fato);
      if (!resultado.ok) throw new Error(`Reavaliação recusada: ${resultado.error.code}`);
    },
  );
  for (const tipo of EVENTOS_QUE_PEDEM_REAVALIACAO) {
    await barramento.assinar(tipo, CONSUMIDOR_DE_REAVALIACAO, consumir);
  }
}
