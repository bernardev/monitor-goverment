import type { ClassificacaoOrcamentaria, ExecucaoDaEmenda } from '@prometeu/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarEmenda } from '../../_api/cliente';
import { identificacaoDaEmenda } from '../../_componentes/emendas';
import { Fonte } from '../../_componentes/fonte';
import { nomeDoTipoDeEmenda, pagoAteAgora, reais } from '../../_componentes/formatacao';

interface Props {
  readonly params: Promise<{ emendaId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const emenda = await buscarEmenda((await params).emendaId);
  return {
    title: emenda
      ? `${identificacaoDaEmenda(emenda)} de ${emenda.autor.nome} | Prometeu`
      : 'Emenda não encontrada | Prometeu',
  };
}

const classificacao = (c: ClassificacaoOrcamentaria) => `${c.codigo} · ${c.nome}`;

/** As fases da despesa, na ordem em que o dinheiro anda. */
function Execucao({ execucao }: { execucao: ExecucaoDaEmenda }): ReactNode {
  return (
    <dl className="resumo">
      <dt>Empenhado</dt>
      <dd>{reais(execucao.empenhadoCentavos)}</dd>
      <dt>Liquidado</dt>
      <dd>{reais(execucao.liquidadoCentavos)}</dd>
      <dt>Pago no ano do orçamento</dt>
      <dd>{reais(execucao.pagoCentavos)}</dd>
      <dt>Restos a pagar inscritos</dt>
      <dd>{reais(execucao.restosInscritosCentavos)}</dd>
      <dt className="recuo">cancelados</dt>
      <dd>{reais(execucao.restosCanceladosCentavos)}</dd>
      <dt className="recuo">pagos</dt>
      <dd>{reais(execucao.restosPagosCentavos)}</dd>
      <dt>
        <strong>Pago até agora</strong>
      </dt>
      <dd>
        <strong>{reais(pagoAteAgora(execucao))}</strong>
      </dd>
    </dl>
  );
}

export default async function PaginaDaEmenda({ params }: Props): Promise<ReactNode> {
  const emenda = await buscarEmenda((await params).emendaId);
  if (!emenda) notFound();

  return (
    <main>
      <p>
        <Link href="/emendas">← Emendas</Link>
      </p>
      <article>
        <h1>
          {identificacaoDaEmenda(emenda)} de{' '}
          {emenda.autor.pessoaId ? (
            <Link href={`/parlamentares/${emenda.autor.pessoaId}`}>{emenda.autor.nome}</Link>
          ) : (
            emenda.autor.nome
          )}
        </h1>
        <p>
          Emenda {nomeDoTipoDeEmenda(emenda.tipo).toLowerCase()} ao orçamento de {emenda.ano},
          código {emenda.codigoNaFonte} no Portal da Transparência.
        </p>
        {emenda.autor.pessoaId && (
          <p className="fonte">
            Autor identificado pelo nome: o Portal não traz outro identificador do parlamentar.
          </p>
        )}
        <Fonte fonte={emenda.fonte} />

        <section>
          <h2>Execução</h2>
          <Execucao execucao={emenda.execucao} />
          <p className="fonte">
            Valores acumulados até a coleta. Empenho é a reserva do dinheiro; liquidação, a
            verificação de que a entrega aconteceu; pagamento, a saída do caixa. O que não é pago no
            ano vira restos a pagar.
          </p>
        </section>

        <section>
          <h2>Destinações</h2>
          <ul className="lista">
            {emenda.destinacoes.map((d) => (
              // A fonte não repete localidade com a mesma classificação: é a chave da destinação.
              <li
                key={`${d.localidade}|${d.funcao.codigo}|${d.subfuncao.codigo}|${d.programa.codigo}|${d.acao.codigo}|${d.planoOrcamentario.codigo}`}
              >
                <strong>{d.localidade}</strong>
                <span>
                  Ação {classificacao(d.acao)} · programa {classificacao(d.programa)}
                </span>
                <span>
                  Função {classificacao(d.funcao)} · subfunção {classificacao(d.subfuncao)}
                  {d.planoOrcamentario.codigo !== '0000'
                    ? ` · plano orçamentário ${classificacao(d.planoOrcamentario)}`
                    : ''}
                </span>
                <span>
                  Empenhado {reais(d.execucao.empenhadoCentavos)} · pago até agora{' '}
                  {reais(pagoAteAgora(d.execucao))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
