import { CadeiaDeEntrega } from '@prometeu/ui';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { editorial, ErroDaApi } from '../../_api/cliente';
import {
  ConclusaoDeReavaliacao,
  DecisaoDeVinculo,
  FormularioDeVeredito,
  Revisao,
  SugestaoDeVinculo,
} from '../../_componentes/formularios';
import {
  ESTAGIOS,
  rotulo,
  SITUACOES_DE_VINCULO,
  TIPOS_DE_ALVO,
  TIPOS_DE_FONTE,
  VEREDITOS,
} from '../../_componentes/rotulos';
import { exigirSessao } from '../../_sessao/sessao';
import {
  concluirReavaliacao,
  confirmarVinculo,
  proporVeredito,
  publicarVeredito,
  recusarVeredito,
  rejeitarVinculo,
  sugerirVinculo,
} from '../acoes';

interface Props {
  readonly params: Promise<{ promessaId: string }>;
}

const data = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(
    new Date(iso),
  );

export default async function Promessa({ params }: Props): Promise<ReactNode> {
  const sessao = await exigirSessao();
  const { promessaId } = await params;
  const promessa = await editorial.buscar(promessaId).catch((erro: unknown) => {
    if (erro instanceof ErroDaApi && erro.status === 404) notFound();
    throw erro;
  });
  const revisa = sessao.papeis.includes('revisor') || sessao.papeis.includes('editor_chefe');
  const curador = sessao.papeis.includes('curador');
  const candidatos = await editorial.candidatos(promessa.promessaId);
  const titulos = new Map(candidatos.map((c) => [`${c.tipoDoAlvo}|${c.idDoAlvo}`, c.titulo]));
  // As capturas das fontes, as dos vínculos confirmados e as dos fatos que mudaram servem de
  // evidência do veredito.
  const capturas = [
    ...new Set([
      ...promessa.fontes.map((f) => f.capturaId),
      ...promessa.vinculos.filter((v) => v.situacao === 'confirmado').flatMap((v) => v.evidencias),
      ...promessa.reavaliacoes.map((r) => r.capturaId),
    ]),
  ];

  return (
    <main>
      <h1>{promessa.texto}</h1>
      <p>
        Estágio: <strong>{rotulo(ESTAGIOS, promessa.estagio)}</strong> · Veredito vigente:{' '}
        <strong>{rotulo(VEREDITOS, promessa.vereditoVigente)}</strong> · Tema {promessa.tema}
      </p>
      <CadeiaDeEntrega alcancados={Object.keys(ESTAGIOS).indexOf(promessa.estagio) + 1} />

      <h2>Fontes</h2>
      <ul className="lista">
        {promessa.fontes.map((f) => (
          <li key={f.fonteId}>
            <q>{f.citacaoLiteral}</q> — {rotulo(TIPOS_DE_FONTE, f.tipo)}, {data(f.dataDaDeclaracao)}
            ,{' '}
            {f.localizacao.tipo === 'pagina'
              ? `página ${f.localizacao.pagina}`
              : `${f.localizacao.inicioEmSegundos}s a ${f.localizacao.fimEmSegundos}s`}
            . Captura {f.capturaId}.
          </li>
        ))}
      </ul>

      {promessa.reavaliacoes.length > 0 && (
        <section>
          <h2>Fatos que mudaram desde a última análise</h2>
          <p className="fonte">
            Fatos com vínculo confirmado mudaram na fonte. Nada mudou sozinho na promessa: veja se o
            vínculo ainda vale e se o veredito precisa de errata, depois marque como reavaliada.
          </p>
          <ul className="lista">
            {promessa.reavaliacoes.map((r) => (
              <li key={`${r.idDoAlvo}|${r.pedidoEm}|${r.motivo}`}>
                <strong>
                  {rotulo(TIPOS_DE_ALVO, r.tipoDoAlvo)}{' '}
                  {titulos.get(`${r.tipoDoAlvo}|${r.idDoAlvo}`) ?? r.idDoAlvo}
                </strong>
                : {r.motivo}{' '}
                <small>
                  ({data(r.pedidoEm)}, captura {r.capturaId})
                </small>
              </li>
            ))}
          </ul>
          <ConclusaoDeReavaliacao concluir={concluirReavaliacao.bind(null, promessa.promessaId)} />
        </section>
      )}

      <h2>Vínculos com fatos</h2>
      <p className="fonte">
        Só o vínculo confirmado conta para o estágio. Sugerir não muda nada na promessa publicada.
      </p>
      {promessa.vinculos.length === 0 && <p>Nenhum vínculo ainda.</p>}
      <ul className="lista">
        {promessa.vinculos.map((v) => (
          <li key={v.vinculoId}>
            <strong>
              {rotulo(TIPOS_DE_ALVO, v.tipoDoAlvo)}{' '}
              {titulos.get(`${v.tipoDoAlvo}|${v.idDoAlvo}`) ?? v.idDoAlvo}
            </strong>{' '}
            comprova {rotulo(ESTAGIOS, v.estagioQueComprova)} ·{' '}
            {rotulo(SITUACOES_DE_VINCULO, v.situacao)}
            {v.situacao !== 'rejeitado' && (
              <DecisaoDeVinculo
                confirmavel={v.situacao === 'sugerido'}
                confirmar={confirmarVinculo.bind(null, promessa.promessaId, v.vinculoId)}
                rejeitar={rejeitarVinculo.bind(null, promessa.promessaId, v.vinculoId)}
              />
            )}
          </li>
        ))}
      </ul>

      {curador && (
        <section>
          <h2>Fatos do autor que podem comprovar a promessa</h2>
          <p className="fonte">
            Proposições de autoria, emendas que indicou e obras pagas por elas, das que têm mais
            palavras em comum com a promessa para as que têm menos. Quem decide é a curadoria.
          </p>
          {candidatos.filter((c) => !c.vinculado).length === 0 && (
            <p>Nenhum fato do autor coletado ainda.</p>
          )}
          <ul className="lista">
            {candidatos
              .filter((c) => !c.vinculado)
              .map((c) => (
                <li key={`${c.tipoDoAlvo}|${c.idDoAlvo}`}>
                  <strong>
                    {rotulo(TIPOS_DE_ALVO, c.tipoDoAlvo)} {c.titulo}
                  </strong>{' '}
                  · {Math.round(c.relevancia * 100)}% das palavras
                  {c.termosEmComum.length > 0 ? ` (${c.termosEmComum.join(', ')})` : ''}
                  <br />
                  <small>{c.detalhe}</small>
                  <SugestaoDeVinculo
                    sugerir={sugerirVinculo.bind(null, promessa.promessaId)}
                    tipoDoAlvo={c.tipoDoAlvo}
                    idDoAlvo={c.idDoAlvo}
                    estagios={c.estagios}
                  />
                </li>
              ))}
          </ul>
        </section>
      )}

      <h2>Histórico de vereditos</h2>
      {promessa.historico.length === 0 && <p>Nenhum veredito publicado.</p>}
      <ol className="lista">
        {promessa.historico.map((r) => (
          <li key={r.registroId}>
            {rotulo(VEREDITOS, r.veredito)} em {data(r.publicadoEm)}
            {r.errata ? ' (errata)' : ''}: {r.justificativa}
          </li>
        ))}
      </ol>

      {promessa.propostaPendente ? (
        <section>
          <h2>Proposta aguardando revisão</h2>
          <p>
            {rotulo(VEREDITOS, promessa.propostaPendente.veredito)}
            {promessa.propostaPendente.errata ? ' (errata)' : ''}:{' '}
            {promessa.propostaPendente.justificativa}
          </p>
          {promessa.propostaPendente.propostoPor === sessao.pessoaId && (
            <p>
              Você propôs este veredito; vereditos sensíveis precisam de outra pessoa na revisão.
            </p>
          )}
          {revisa && (
            <Revisao
              publicar={publicarVeredito.bind(null, promessa.promessaId)}
              recusar={recusarVeredito.bind(null, promessa.promessaId)}
            />
          )}
        </section>
      ) : (
        curador && (
          <section>
            <h2>Propor veredito</h2>
            <FormularioDeVeredito
              propor={proporVeredito.bind(null, promessa.promessaId)}
              capturas={capturas}
            />
          </section>
        )
      )}
    </main>
  );
}
