import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { editorial, ErroDaApi } from '../../_api/cliente';
import { FormularioDeVeredito, Revisao } from '../../_componentes/formularios';
import { ESTAGIOS, rotulo, TIPOS_DE_FONTE, VEREDITOS } from '../../_componentes/rotulos';
import { exigirSessao } from '../../_sessao/sessao';
import { proporVeredito, publicarVeredito, recusarVeredito } from '../acoes';

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
  const capturas = [...new Set(promessa.fontes.map((f) => f.capturaId))];

  return (
    <main>
      <p>
        <Link href="/">← Painel</Link>
      </p>
      <h1>{promessa.texto}</h1>
      <p>
        Estágio: <strong>{rotulo(ESTAGIOS, promessa.estagio)}</strong> · Veredito vigente:{' '}
        <strong>{rotulo(VEREDITOS, promessa.vereditoVigente)}</strong> · Tema {promessa.tema}
      </p>

      <h2>Fontes</h2>
      <ul>
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

      <h2>Histórico de vereditos</h2>
      {promessa.historico.length === 0 && <p>Nenhum veredito publicado.</p>}
      <ol>
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
        sessao.papeis.includes('curador') && (
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
