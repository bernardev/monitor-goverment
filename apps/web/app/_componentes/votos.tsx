import type { ParticipacaoEmVotacao, VotosDoParlamentar } from '@prometeu/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { dia, nomeDaOpcao, nomeDaSituacaoSemVoto, nomeDoMotivo } from './formatacao';

/**
 * O voto do parlamentar em cada votação nominal do plenário. Quando não há voto, mostra como a casa
 * apurou o dia dele, sem adivinhar o motivo: "sem voto registrado" não é o mesmo que ausência.
 */
export function Votos({ votos }: { votos: VotosDoParlamentar }): ReactNode {
  const { resumo } = votos;
  // A contagem não é de todas as votações do período: só das que têm voto dele ou frequência
  // apurada no dia. Chamá-la de "votações coletadas" seria falso.
  const periodo = `de ${dia(votos.de)} a ${dia(votos.ate)}`;
  const cobertura = (
    <p className="fonte">
      Entram as votações em que o parlamentar votou, as que o listam entre quem não votou (o Senado
      lista todos os senadores em exercício) e as dos dias em que a casa apurou a frequência dele.
      Só as votações já coletadas da fonte oficial aparecem aqui.
    </p>
  );

  if (resumo.votacoes === 0) {
    return (
      <section>
        <h2>Votações nominais</h2>
        <p>Nenhuma votação nominal {periodo} em que dê para saber o que o parlamentar fez.</p>
        {cobertura}
      </section>
    );
  }
  return (
    <section>
      <h2>Votações nominais</h2>
      <p>
        Votações nominais {periodo} em que dá para saber o que o parlamentar fez: {resumo.votacoes}.
      </p>
      {cobertura}
      <dl className="resumo">
        <dt>Com voto registrado</dt>
        <dd>{resumo.comVoto}</dd>
        <dt>Sem voto registrado</dt>
        <dd>{resumo.semVotoRegistrado}</dd>
        {resumo.porOpcao.map((o) => (
          <Opcao key={o.opcao} nome={nomeDaOpcao(o.opcao)} votos={o.votos} />
        ))}
      </dl>
      <ul className="lista">
        {votos.participacoes.map((p) => (
          <li key={p.votacao.votacaoId}>
            <strong>{dia(p.votacao.dia)}</strong>:{' '}
            <Link href={`/votacoes/${p.votacao.votacaoId}`}>{p.votacao.descricao}</Link>
            <span>{oQueFez(p)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Opcao({ nome, votos }: { nome: string; votos: number }): ReactNode {
  return (
    <>
      <dt className="recuo">{nome}</dt>
      <dd>{votos}</dd>
    </>
  );
}

function oQueFez({ voto, semVoto, frequenciaNoDia }: ParticipacaoEmVotacao): string {
  if (voto) {
    const grafia = voto.registroNaFonte ? ` (registro da casa: “${voto.registroNaFonte}”)` : '';
    return `Voto: ${nomeDaOpcao(voto.opcao)}${grafia}.`;
  }
  // A própria votação diz por que ele não votou (Senado): vale mais do que a frequência do dia.
  if (semVoto) {
    const motivo = semVoto.motivo ? `: ${nomeDoMotivo(semVoto.motivo.categoria)}` : '';
    return `Não votou. ${nomeDaSituacaoSemVoto(semVoto.situacao)}${motivo} (registro da casa: “${semVoto.registroNaFonte}”).`;
  }
  if (!frequenciaNoDia) return 'Sem voto registrado.';
  const { situacao, motivo } = frequenciaNoDia;
  if (situacao === 'presente') return 'Sem voto registrado. Presente na sessão do dia.';
  if (situacao === 'ausencia_justificada' && motivo) {
    return `Sem voto registrado. Ausência justificada no dia: ${nomeDoMotivo(motivo.categoria)}.`;
  }
  return 'Sem voto registrado. Ausente no dia, sem justificativa aceita.';
}
