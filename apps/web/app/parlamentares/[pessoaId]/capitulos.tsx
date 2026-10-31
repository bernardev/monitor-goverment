import type {
  AutoriaDoParlamentar,
  EmendasDoParlamentar,
  FrequenciaDoParlamentar,
  ObraResumo,
  OpcaoDeVoto,
  Pagina,
  ParticipacaoEmVotacao,
  VotosDoParlamentar,
} from '@prometeu/contracts';
import {
  CadeiaDeEntrega,
  Calendario,
  Capitulo,
  Cifra,
  type Marca,
  type Parte,
  Proporcao,
  type Tom,
} from '@prometeu/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { destinos, identificacaoDaEmenda } from '../../_componentes/emendas';
import { Fonte } from '../../_componentes/fonte';
import {
  dia,
  identificacao,
  nomeDaCasa,
  nomeDaOpcao,
  nomeDoMotivo,
  nomeDoResultado,
  pagoAteAgora,
  reais,
  reaisResumidos,
} from '../../_componentes/formatacao';
import { lugarDaObra, situacaoEMedicao } from '../../_componentes/obras';

const NUMERO = new Intl.NumberFormat('pt-BR');

/** Os verbos da página, na ordem em que aparecem; o sumário do topo leva a cada um. */
export const VERBOS = {
  prometeu: 'Prometeu',
  compareceu: 'Compareceu',
  votou: 'Votou',
  propos: 'Propôs',
  indicou: 'Indicou',
  financiou: 'Financiou',
} as const;

export function Promessas(): ReactNode {
  return (
    <Capitulo
      id="prometeu"
      campo="grafite"
      verbo="Prometeu."
      frase="Nenhuma promessa publicada ainda. Quando a curadoria publicar uma, ela aparece aqui com a fonte, o trecho e até onde chegou."
      aoLado={<CadeiaDeEntrega alcancados={0} />}
      nota={
        <p>
          Cada promessa entra com o trecho literal de onde veio. Só um vínculo confirmado com um
          fato oficial acende um estágio, e todo veredito passa por duas pessoas.
        </p>
      }
    />
  );
}

const TOM_DO_DIA: Readonly<Record<string, Marca>> = {
  presente: { tom: 'forte', descricao: 'presente' },
  ausencia_justificada: { tom: 'fraco', descricao: 'ausência justificada' },
  ausente: { tom: 'vazio', descricao: 'ausência sem justificativa' },
};

export function Presenca({ frequencia }: { frequencia: FrequenciaDoParlamentar }): ReactNode {
  const { resumo } = frequencia;
  const periodo = `de ${dia(frequencia.de)} a ${dia(frequencia.ate)}`;
  const ausencias = frequencia.dias.filter((d) => d.situacao !== 'presente');
  const nota = (
    <p>
      Só entram os dias de sessão já coletados da fonte oficial; dias anteriores ao início da coleta
      não aparecem aqui.
    </p>
  );
  if (resumo.diasComSessao === 0) {
    return (
      <Capitulo
        id="compareceu"
        campo="papel"
        verbo="Compareceu."
        frase={`Nenhum dia com sessão coletado ${periodo}.`}
        nota={nota}
      />
    );
  }
  const faltas = [
    resumo.ausenciasJustificadas > 0
      ? `${String(resumo.ausenciasJustificadas)} com justificativa aceita pela casa`
      : '',
    resumo.ausenciasSemJustificativa > 0
      ? `${String(resumo.ausenciasSemJustificativa)} sem justificativa`
      : '',
  ].filter(Boolean);
  return (
    <Capitulo
      id="compareceu"
      campo="papel"
      verbo="Compareceu."
      frase={
        <>
          A {NUMERO.format(resumo.presencas)} dos {NUMERO.format(resumo.diasComSessao)} dias com
          sessão, {periodo}.
          {faltas.length > 0 ? ` Ausências: ${faltas.join(' e ')}.` : ' Nenhuma ausência.'}
        </>
      }
      aoLado={
        <Calendario
          rotulo={`${String(resumo.presencas)} presenças em ${String(resumo.diasComSessao)} dias com sessão`}
          dias={frequencia.dias.map((d) => ({
            dia: d.dia,
            valor: TOM_DO_DIA[d.situacao] ?? { tom: 'vazio', descricao: d.registroNaFonte },
          }))}
          legenda="Cada quadrado é um dia com sessão. Escuro: presente. Claro: ausência justificada. Branco: ausência sem justificativa."
        />
      }
      nota={
        <>
          {nota}
          {frequencia.dias[0] && <Fonte fonte={frequencia.dias[0].fonte} />}
        </>
      }
    >
      {ausencias.length > 0 && (
        <ul className="fichas">
          {ausencias.slice(0, 6).map((d) => (
            <li key={`${d.casa}-${d.dia}`} className="ficha">
              <p className="ficha__titulo">{dia(d.dia)}</p>
              <p className="ficha__texto">
                {d.motivo
                  ? `${nomeDoMotivo(d.motivo.categoria)}: “${d.motivo.descricaoNaFonte}”`
                  : 'Sem justificativa aceita pela casa.'}
              </p>
              <p className="ficha__nota">{d.sessoes.map((s) => s.descricao).join('; ')}</p>
            </li>
          ))}
        </ul>
      )}
    </Capitulo>
  );
}

const TOM_DO_VOTO: Readonly<Record<OpcaoDeVoto, Tom>> = {
  sim: 'forte',
  nao: 'medio',
  abstencao: 'fraco',
  obstrucao: 'fraco',
  presidente_da_sessao: 'fraco',
  secreto: 'fraco',
};

const ROTULO_CURTO: Readonly<Record<OpcaoDeVoto, string>> = {
  sim: 'sim',
  nao: 'não',
  abstencao: 'abstenção',
  obstrucao: 'obstrução',
  presidente_da_sessao: 'presidindo',
  secreto: 'secreto',
};

export function Votos({ votos }: { votos: VotosDoParlamentar }): ReactNode {
  const { resumo } = votos;
  const periodo = `de ${dia(votos.de)} a ${dia(votos.ate)}`;
  const nota = (
    <p>
      Entram as votações em que votou, as que o listam entre quem não votou e as dos dias em que a
      casa apurou a frequência. Só as votações já coletadas da fonte oficial aparecem aqui.
    </p>
  );
  if (resumo.votacoes === 0) {
    return (
      <Capitulo
        id="votou"
        campo="aco"
        verbo="Votou."
        frase={`Nenhuma votação nominal ${periodo} em que dê para saber o que fez.`}
        nota={nota}
      />
    );
  }
  const partes: Parte[] = [
    ...resumo.porOpcao.map((o) => ({
      rotulo: ROTULO_CURTO[o.opcao],
      valor: o.votos,
      tom: TOM_DO_VOTO[o.opcao],
    })),
    { rotulo: 'sem voto', valor: resumo.semVotoRegistrado, tom: 'vazio' },
  ];
  return (
    <Capitulo
      id="votou"
      campo="aco"
      verbo="Votou."
      frase={`Em ${NUMERO.format(resumo.comVoto)} das ${NUMERO.format(resumo.votacoes)} votações nominais ${periodo}. Nas outras ${NUMERO.format(resumo.semVotoRegistrado)}, a casa não registrou voto.`}
      aoLado={<Proporcao partes={partes} />}
      nota={nota}
    >
      <ul className="linhas">
        {votos.participacoes.slice(0, 6).map((p) => (
          <ParticipacaoNaVotacao key={p.votacao.votacaoId} participacao={p} />
        ))}
      </ul>
    </Capitulo>
  );
}

function ParticipacaoNaVotacao({
  participacao: { votacao, voto },
}: {
  participacao: ParticipacaoEmVotacao;
}): ReactNode {
  const [proposicao] = votacao.proposicoes;
  return (
    <li className="linha">
      <p className="linha__chave">{voto ? nomeDaOpcao(voto.opcao) : 'Sem voto registrado'}</p>
      <div className="linha__corpo">
        <Link href={`/votacoes/${votacao.votacaoId}`}>
          {proposicao?.ementa ?? votacao.descricao}
        </Link>
        <p className="nota">
          {dia(votacao.dia)}
          {proposicao ? ` · ${identificacao(proposicao)}` : ''} ·{' '}
          {nomeDoResultado(votacao.resultado)}
        </p>
      </div>
    </li>
  );
}

export function Autorias({ autorias }: { autorias: Pagina<AutoriaDoParlamentar> }): ReactNode {
  const nota = (
    <p>
      Só entram as proposições normativas (PEC, PLP, PL, MPV e PDL) que se moveram desde o início da
      coleta.
    </p>
  );
  if (autorias.total === 0) {
    return (
      <Capitulo
        id="propos"
        campo="papel"
        verbo="Propôs."
        frase="Nenhuma proposição coletada com este parlamentar entre os autores."
        nota={nota}
      />
    );
  }
  return (
    <Capitulo
      id="propos"
      campo="papel"
      verbo="Propôs."
      frase={`${NUMERO.format(autorias.total)} ${autorias.total === 1 ? 'proposição coletada' : 'proposições coletadas'} com este parlamentar entre os autores${autorias.total > 6 ? '. Aqui, as movimentadas por último' : ''}.`}
      nota={nota}
    >
      <ul className="fichas">
        {autorias.itens.slice(0, 6).map(({ proposicao: p, proponente: assina }) => (
          <li key={p.proposicaoId} className="ficha">
            <Link href={`/proposicoes/${p.proposicaoId}`} className="ficha__titulo">
              {identificacao(p)}
            </Link>
            <p className="ficha__texto">{p.ementa ?? 'Ementa não informada pela casa.'}</p>
            <p className="ficha__nota">
              {nomeDaCasa(p.casa)}
              {p.situacao ? ` · ${p.situacao.descricao}` : ''}
              {assina ? '' : ' · assina junto'}
            </p>
          </li>
        ))}
      </ul>
    </Capitulo>
  );
}

export function Emendas({ emendas }: { emendas: EmendasDoParlamentar }): ReactNode {
  const nota = (
    <p>
      Emendas individuais desde o orçamento de 2023, do Portal da Transparência, ligadas ao
      parlamentar quando o nome do autor corresponde a uma só pessoa em exercício. Pago soma o pago
      no ano do orçamento e o pago depois, como restos a pagar.
    </p>
  );
  if (emendas.total === 0) {
    return (
      <Capitulo
        id="indicou"
        campo="areia"
        verbo="Indicou."
        frase="Nenhuma emenda ao orçamento coletada com este parlamentar como autor."
        nota={nota}
      />
    );
  }
  const empenhado = BigInt(emendas.soma.empenhadoCentavos);
  const pago = pagoAteAgora(emendas.soma);
  const aPagar = empenhado > pago ? empenhado - pago : 0n;
  const parcela = empenhado > 0n ? Number((pago * 100n) / empenhado) : 0;
  return (
    <Capitulo
      id="indicou"
      campo="areia"
      verbo="Indicou."
      frase={`${NUMERO.format(emendas.total)} ${emendas.total === 1 ? 'emenda' : 'emendas'} ao orçamento, com ${reaisResumidos(empenhado)} empenhados. Até agora, ${reaisResumidos(pago)} foram pagos.`}
      aoLado={
        <div className="pilha">
          <Cifra
            valor={`${String(parcela)}%`}
            legenda="do valor empenhado já foi pago a quem recebe."
          />
          <Proporcao
            partes={[
              {
                rotulo: 'pago',
                valor: Number(pago / 100n),
                tom: 'forte',
                texto: `${reaisResumidos(pago)} pagos`,
              },
              {
                rotulo: 'a pagar',
                valor: Number(aPagar / 100n),
                tom: 'vazio',
                texto: `${reaisResumidos(aPagar)} a pagar`,
              },
            ]}
          />
        </div>
      }
      nota={nota}
    >
      <div className="rolagem">
        <table className="tabela">
          <caption className="oculto">As emendas de maior empenho</caption>
          <thead>
            <tr>
              <th scope="col">Emenda</th>
              <th scope="col">Destino</th>
              <th scope="col" className="numero">
                Empenhado
              </th>
              <th scope="col" className="numero">
                Pago
              </th>
            </tr>
          </thead>
          <tbody>
            {emendas.itens.slice(0, 8).map((e) => (
              <tr key={e.emendaId}>
                <td>
                  <Link href={`/emendas/${e.emendaId}`}>{identificacaoDaEmenda(e)}</Link>
                </td>
                <td data-rotulo="Destino:">{destinos(e.localidades)}</td>
                <td className="numero" data-rotulo="Empenhado">
                  {reais(e.execucao.empenhadoCentavos)}
                </td>
                <td className="numero" data-rotulo="Pago">
                  {reais(pagoAteAgora(e.execucao))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Capitulo>
  );
}

export interface ObrasDoParlamentar {
  readonly maiores: Pagina<ObraResumo>;
  readonly concluidas: number;
  readonly emExecucao: number;
  readonly paralisadas: number;
}

export function Obras({ obras }: { obras: ObrasDoParlamentar }): ReactNode {
  const { maiores, concluidas, emExecucao, paralisadas } = obras;
  const nota = (
    <p>
      Obras do Obrasgov pagas por ao menos uma emenda deste parlamentar. A situação e a medição são
      as que a fonte informa.
    </p>
  );
  if (maiores.total === 0) {
    return (
      <Capitulo
        id="financiou"
        campo="papel"
        verbo="Financiou."
        frase="Nenhuma obra coletada paga por emendas deste parlamentar."
        nota={nota}
      />
    );
  }
  const outras = maiores.total - concluidas - emExecucao - paralisadas;
  return (
    <Capitulo
      id="financiou"
      campo="papel"
      verbo="Financiou."
      frase={`${NUMERO.format(maiores.total)} ${maiores.total === 1 ? 'obra paga' : 'obras pagas'} pelas emendas que indicou. ${NUMERO.format(concluidas)} concluídas, ${NUMERO.format(emExecucao)} em execução.`}
      aoLado={
        <Proporcao
          partes={[
            { rotulo: 'concluídas', valor: concluidas, tom: 'forte' },
            { rotulo: 'em execução', valor: emExecucao, tom: 'medio' },
            { rotulo: 'paralisadas', valor: paralisadas, tom: 'fraco' },
            { rotulo: 'planejadas ou outras', valor: outras, tom: 'vazio' },
          ]}
        />
      }
      nota={nota}
    >
      <ul className="fichas">
        {maiores.itens.map((o) => (
          <li key={o.obraId} className="ficha">
            <Link href={`/obras/${o.obraId}`} className="ficha__titulo">
              {lugarDaObra(o)}
            </Link>
            <p className="ficha__texto">{o.nome}</p>
            <p className="ficha__nota">
              {situacaoEMedicao(o)} · {reais(o.investimentoPrevistoCentavos)}
            </p>
          </li>
        ))}
      </ul>
    </Capitulo>
  );
}
