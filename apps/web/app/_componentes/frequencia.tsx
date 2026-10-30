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

  if (resumo.diasComSessao === 0) {
    return (
      <section>
        <h2>Presença no plenário</h2>
        <p>Nenhum dia com sessão registrado {periodo}.</p>
      </section>
    );
  }
  return (
    <section>
      <h2>Presença no plenário</h2>
      <p>
        {periodo}, houve sessão em {resumo.diasComSessao}{' '}
        {resumo.diasComSessao === 1 ? 'dia' : 'dias'}.
      </p>
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
