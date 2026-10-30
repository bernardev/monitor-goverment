import type { FrequenciaDoParlamentar } from '@prometeu/contracts';
import type { ReactNode } from 'react';

import { Fonte } from './fonte';
import { dia, nomeDoMotivo } from './formatacao';

/**
 * Presença no plenário com o motivo de cada ausência. Mostra contagens de dias, não um percentual
 * solto: o número só tem sentido ao lado de quantos dias houve sessão.
 */
export function Frequencia({ frequencia }: { frequencia: FrequenciaDoParlamentar }): ReactNode {
  const { resumo } = frequencia;
  const ausencias = frequencia.dias.filter((d) => d.situacao !== 'presente');
  const periodo = `de ${dia(frequencia.de)} a ${dia(frequencia.ate)}`;
  // A contagem é do que já foi coletado, não de todas as sessões do período: dizer "houve sessão em N
  // dias" seria falso enquanto a coleta não cobrir o período inteiro.
  const cobertura = (
    <p className="fonte">
      Só entram os dias de sessão já coletados da fonte oficial; dias anteriores ao início da coleta
      não aparecem aqui.
    </p>
  );

  if (resumo.diasComSessao === 0) {
    return (
      <section>
        <h2>Presença no plenário</h2>
        <p>Nenhum dia com sessão coletado {periodo}.</p>
        {cobertura}
      </section>
    );
  }
  return (
    <section>
      <h2>Presença no plenário</h2>
      <p>
        Dias com sessão coletados {periodo}: {resumo.diasComSessao}.
      </p>
      {cobertura}
      <dl className="resumo">
        <dt>Presente</dt>
        <dd>{resumo.presencas}</dd>
        <dt>Ausência justificada</dt>
        <dd>{resumo.ausenciasJustificadas}</dd>
        <dt>Ausência sem justificativa</dt>
        <dd>{resumo.ausenciasSemJustificativa}</dd>
      </dl>
      {resumo.porMotivo.length > 0 && (
        <p>
          Motivos aceitos pela casa:{' '}
          {resumo.porMotivo
            .map((m) => `${nomeDoMotivo(m.categoria)} (${String(m.dias)})`)
            .join(', ')}
          .
        </p>
      )}
      {ausencias.length > 0 && (
        <>
          <h3>Ausências</h3>
          <ul className="lista">
            {ausencias.map((d) => (
              <li key={`${d.casa}-${d.dia}`}>
                <strong>{dia(d.dia)}</strong>:{' '}
                {d.motivo
                  ? `${nomeDoMotivo(d.motivo.categoria)} (“${d.motivo.descricaoNaFonte}”)`
                  : 'sem justificativa aceita'}
                <span>
                  {d.sessoes.map((s) => s.descricao).join('; ')}. Registro da casa: “
                  {d.registroNaFonte}”.
                </span>
                <Fonte fonte={d.fonte} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
