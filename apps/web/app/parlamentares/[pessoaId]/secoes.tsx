import type {
  AutoriaDoParlamentar,
  EmendasDoParlamentar,
  FrequenciaDoParlamentar,
  ObraResumo,
  Pagina,
  ParticipacaoEmVotacao,
  VotosDoParlamentar,
} from '@prometeu/contracts';
import {
  CadeiaDeEntrega,
  Calendario,
  Explica,
  type ItemDoRanking,
  type Marca,
  type Parte,
  Proporcao,
  Ranking,
  Secao,
} from '@prometeu/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { destinos, identificacaoDaEmenda } from '../../_componentes/emendas';
import { FonteDaSecao } from '../../_componentes/fonte';
import { fonteMaisRecente } from '../../_componentes/fonte-mais-recente';
import {
  dia,
  identificacao,
  nomeDaCasa,
  nomeDaOpcao,
  nomeDoMotivo,
  nomeDoResultado,
  pagoAteAgora,
  partesPagoEAPagar,
  periodoDasEmendas,
  periodoEmMeses,
  reais,
  reaisResumidos,
  NUMERO,
} from '../../_componentes/formatacao';
import { GLOSSARIO } from '../../_componentes/glossario';
import { lugarDaObra, situacaoEMedicao } from '../../_componentes/obras';
import { ROTULO_DA_OPCAO, TOM_DA_OPCAO } from '../../_componentes/placar';

/** As seções da página, na ordem em que aparecem; o sumário do topo leva a cada uma. */
export const SECOES = {
  promessas: 'Promessas',
  presenca: 'Presença nas sessões',
  votacoes: 'Votações',
  projetos: 'Projetos apresentados',
  emendas: 'Emendas',
  obras: 'Obras com dinheiro das emendas',
} as const;

export function Promessas(): ReactNode {
  return (
    <Secao id="promessas" titulo={SECOES.promessas}>
      <p>
        Nenhuma promessa publicada ainda. Quando a curadoria publicar uma, ela aparece aqui com a
        fonte, o trecho e até onde chegou.
      </p>
      <CadeiaDeEntrega alcancados={0} />
      <p className="nota">
        Cada promessa entra com o trecho literal de onde veio. Só um vínculo confirmado com um fato
        oficial acende um estágio, e todo veredito passa por duas pessoas.
      </p>
    </Secao>
  );
}

const TOM_DO_DIA: Readonly<Record<string, Marca>> = {
  presente: { tom: 'forte', descricao: 'presente' },
  ausencia_justificada: { tom: 'fraco', descricao: 'faltou, com justificativa' },
  ausente: { tom: 'vazio', descricao: 'faltou, sem justificativa' },
};

export function Presenca({ frequencia }: { frequencia: FrequenciaDoParlamentar }): ReactNode {
  const { resumo } = frequencia;
  const periodo = periodoEmMeses(frequencia.de, frequencia.ate);
  const ausencias = frequencia.dias.filter((d) => d.situacao !== 'presente');
  const nota = (
    <p className="nota">
      Só entram os dias de sessão já coletados da fonte oficial; dias anteriores ao início da coleta
      não aparecem aqui.
    </p>
  );
  const fonte = (
    <FonteDaSecao fonte={frequencia.dias[0]?.fonte} publicador="Câmara dos Deputados" />
  );
  if (resumo.diasComSessao === 0) {
    return (
      <Secao id="presenca" titulo={SECOES.presenca} periodo={periodo} fonte={fonte}>
        <p>Nenhum dia com sessão coletado no período.</p>
        {nota}
      </Secao>
    );
  }
  const faltas = [
    resumo.ausenciasJustificadas > 0
      ? `${NUMERO.format(resumo.ausenciasJustificadas)} com justificativa aceita pela Câmara`
      : '',
    resumo.ausenciasSemJustificativa > 0
      ? `${NUMERO.format(resumo.ausenciasSemJustificativa)} sem justificativa`
      : '',
  ].filter(Boolean);
  return (
    <Secao id="presenca" titulo={SECOES.presenca} periodo={periodo} fonte={fonte}>
      <p>
        Presente em {NUMERO.format(resumo.presencas)} dos {NUMERO.format(resumo.diasComSessao)} dias
        com sessão.
        {faltas.length > 0 ? ` Ausências: ${faltas.join(' e ')}.` : ' Nenhuma ausência.'}
      </p>
      <Calendario
        rotulo={`${String(resumo.presencas)} presenças em ${String(resumo.diasComSessao)} dias com sessão`}
        dias={frequencia.dias.map((d) => ({
          dia: d.dia,
          valor: TOM_DO_DIA[d.situacao] ?? { tom: 'vazio', descricao: d.registroNaFonte },
        }))}
        legenda={Object.values(TOM_DO_DIA)}
      />
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
      {nota}
    </Secao>
  );
}

export function Votos({ votos }: { votos: VotosDoParlamentar }): ReactNode {
  const { resumo } = votos;
  const periodo = periodoEmMeses(votos.de, votos.ate);
  const nota = (
    <p className="nota">
      Entram as votações em que votou, as que o listam entre quem não votou e as dos dias em que a
      casa registrou presença. Só as votações já coletadas da fonte oficial aparecem aqui.
    </p>
  );
  const fonte = (
    <FonteDaSecao
      fonte={votos.participacoes[0]?.votacao.fonte}
      publicador="Câmara dos Deputados e Senado Federal"
    />
  );
  if (resumo.votacoes === 0) {
    return (
      <Secao id="votacoes" titulo={SECOES.votacoes} periodo={periodo} fonte={fonte}>
        <p>Nenhuma votação nominal no período em que dê para saber o que fez.</p>
        <Explica termo="Votação nominal">{GLOSSARIO.votacaoNominal}</Explica>
        {nota}
      </Secao>
    );
  }
  const partes: Parte[] = [
    ...resumo.porOpcao.map((o) => ({
      rotulo: ROTULO_DA_OPCAO[o.opcao],
      valor: o.votos,
      tom: TOM_DA_OPCAO[o.opcao],
    })),
    { rotulo: 'sem voto', valor: resumo.semVotoRegistrado, tom: 'vazio' },
  ];
  return (
    <Secao id="votacoes" titulo={SECOES.votacoes} periodo={periodo} fonte={fonte}>
      <p>
        Há voto registrado em {NUMERO.format(resumo.comVoto)} das {NUMERO.format(resumo.votacoes)}{' '}
        votações nominais. Nas outras {NUMERO.format(resumo.semVotoRegistrado)}, a casa não
        registrou voto.
      </p>
      <Explica termo="Votação nominal">{GLOSSARIO.votacaoNominal}</Explica>
      <Proporcao partes={partes} />
      <ul className="linhas">
        {votos.participacoes.slice(0, 6).map((p) => (
          <ParticipacaoNaVotacao key={p.votacao.votacaoId} participacao={p} />
        ))}
      </ul>
      {nota}
    </Secao>
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
    <p className="nota">
      Só entram os projetos que podem virar lei (propostas de emenda à Constituição, projetos de lei
      e medidas provisórias) que andaram desde o início da coleta.
    </p>
  );
  const periodo = 'desde o início da coleta';
  const fonte = (
    <FonteDaSecao
      fonte={autorias.itens[0]?.proposicao.fonte}
      publicador="Câmara dos Deputados e Senado Federal"
    />
  );
  if (autorias.total === 0) {
    return (
      <Secao id="projetos" titulo={SECOES.projetos} periodo={periodo} fonte={fonte}>
        <p>Nenhum projeto coletado em que este parlamentar seja autor.</p>
        {nota}
      </Secao>
    );
  }
  return (
    <Secao id="projetos" titulo={SECOES.projetos} periodo={periodo} fonte={fonte}>
      <p>
        {`${NUMERO.format(autorias.total)} ${autorias.total === 1 ? 'projeto coletado' : 'projetos coletados'} em que este parlamentar é autor ou assina junto${autorias.total > 6 ? '. Aqui, os que andaram por último' : ''}.`}
      </p>
      <ul className="fichas">
        {autorias.itens.slice(0, 6).map(({ proposicao: p, proponente: assina }) => (
          <li key={p.proposicaoId} className="ficha">
            <Link href={`/proposicoes/${p.proposicaoId}`} className="ficha__titulo">
              {identificacao(p)}
            </Link>
            <p className="ficha__texto">{p.ementa ?? 'Resumo não informado pela casa.'}</p>
            <p className="ficha__nota">
              {nomeDaCasa(p.casa)}
              {p.situacao ? ` · ${p.situacao.descricao}` : ''}
              {assina ? '' : ' · assina junto'}
            </p>
          </li>
        ))}
      </ul>
      {nota}
    </Secao>
  );
}

export function Emendas({ emendas }: { emendas: EmendasDoParlamentar }): ReactNode {
  const fonteDaColeta = fonteMaisRecente(emendas);
  const periodo = periodoDasEmendas(fonteDaColeta?.coletadaEm ?? null);
  const fonte = <FonteDaSecao fonte={fonteDaColeta} publicador="Portal da Transparência" />;
  const nota = (
    <p className="nota">
      Emendas individuais, do Portal da Transparência, ligadas ao parlamentar quando o nome do autor
      corresponde a uma só pessoa que estava em exercício no ano anterior ao do orçamento. Pago soma
      o que saiu no ano do orçamento e o que saiu nos anos seguintes.
    </p>
  );
  if (emendas.total === 0) {
    return (
      <Secao id="emendas" titulo={SECOES.emendas} periodo={periodo} fonte={fonte}>
        <p>Nenhuma emenda ao orçamento coletada com este parlamentar como autor.</p>
        {nota}
      </Secao>
    );
  }
  const empenhado = BigInt(emendas.soma.empenhadoCentavos);
  const pago = pagoAteAgora(emendas.soma);
  const itens: ItemDoRanking[] = emendas.itens.slice(0, 8).map((e) => ({
    chave: e.emendaId,
    rotulo: <Link href={`/emendas/${e.emendaId}`}>{identificacaoDaEmenda(e)}</Link>,
    detalhe: `${destinos(e.localidades)} · ${reais(pagoAteAgora(e.execucao))} pagos`,
    valor: Number(BigInt(e.execucao.empenhadoCentavos) / 100n),
    texto: reaisResumidos(e.execucao.empenhadoCentavos),
  }));
  return (
    <Secao id="emendas" titulo={SECOES.emendas} periodo={periodo} fonte={fonte}>
      <p>
        {`${NUMERO.format(emendas.total)} ${emendas.total === 1 ? 'emenda' : 'emendas'}, com ${reaisResumidos(empenhado)} reservados no orçamento. Já foram pagos ${reaisResumidos(pago)}.`}
      </p>
      <Proporcao partes={partesPagoEAPagar(pago, empenhado)} />
      <Ranking itens={itens} />
      <p className="nota">
        {emendas.total > itens.length
          ? `As ${String(itens.length)} emendas mais recentes, com o valor reservado (empenhado) de cada uma.`
          : 'Cada emenda, com o valor reservado (empenhado).'}
      </p>
      {nota}
    </Secao>
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
  const periodo = periodoDasEmendas(maiores.itens[0]?.fonte.coletadaEm ?? null);
  const fonte = <FonteDaSecao fonte={maiores.itens[0]?.fonte} publicador="Obrasgov.br" />;
  const nota = (
    <p className="nota">
      Obras do Obrasgov com dinheiro de ao menos uma emenda deste parlamentar. A situação e a
      medição são as que a fonte informa.
    </p>
  );
  if (maiores.total === 0) {
    return (
      <Secao id="obras" titulo={SECOES.obras} periodo={periodo} fonte={fonte}>
        <p>Nenhuma obra coletada com dinheiro das emendas deste parlamentar.</p>
        {nota}
      </Secao>
    );
  }
  const outras = maiores.total - concluidas - emExecucao - paralisadas;
  return (
    <Secao id="obras" titulo={SECOES.obras} periodo={periodo} fonte={fonte}>
      <p>
        {`${NUMERO.format(maiores.total)} ${maiores.total === 1 ? 'obra' : 'obras'} com dinheiro das emendas deste parlamentar. ${NUMERO.format(concluidas)} concluídas, ${NUMERO.format(emExecucao)} em execução.`}
      </p>
      <Explica termo="Situação da obra">{GLOSSARIO.situacaoDaObra}</Explica>
      <Proporcao
        partes={[
          { rotulo: 'concluídas', valor: concluidas, tom: 'forte' },
          { rotulo: 'em execução', valor: emExecucao, tom: 'medio' },
          { rotulo: 'paralisadas', valor: paralisadas, tom: 'fraco' },
          { rotulo: 'planejadas ou outras', valor: outras, tom: 'vazio' },
        ]}
      />
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
      {nota}
    </Secao>
  );
}
