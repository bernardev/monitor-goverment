import type { ClassificacaoOrcamentaria } from '@prometeu/contracts';
import { Explica, FaixaDeNumeros, Proporcao, Ranking, Secao } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarEmenda } from '../../_api/cliente';
import { identificacaoDaEmenda, tipoEModalidade } from '../../_componentes/emendas';
import { Convenios, Favorecidos } from '../../_componentes/favorecidos';
import { FonteDaSecao } from '../../_componentes/fonte';
import {
  nomeDaModalidade,
  nomeDoTipoDeEmenda,
  pagoAteAgora,
  partesPagoEAPagar,
  reais,
  reaisResumidos,
} from '../../_componentes/formatacao';
import { GLOSSARIO } from '../../_componentes/glossario';
import { ItemDeObra } from '../../_componentes/obras';
import { Topo } from '../../_componentes/topo';
import { fasesDaEmenda, numerosDaEmenda, periodoDaEmenda, periodoDosFavorecidos } from './numeros';

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

const NUMERO = new Intl.NumberFormat('pt-BR');

/** `1 destino` ou `2 destinos`. */
function plural(n: number, um: string, varios: string): string {
  return `${NUMERO.format(n)} ${n === 1 ? um : varios}`;
}

export default async function PaginaDaEmenda({ params }: Props): Promise<ReactNode> {
  const emenda = await buscarEmenda((await params).emendaId);
  if (!emenda) notFound();
  const empenhado = BigInt(emenda.execucao.empenhadoCentavos);
  const pago = pagoAteAgora(emenda.execucao);
  const { autor, favorecidos, convenios, obras } = emenda;
  const periodo = periodoDaEmenda(emenda.ano, emenda.fonte.coletadaEm);
  const secoes = [
    ['reservado-e-pago', 'Quanto foi reservado e pago'],
    ['destino', 'Para onde foi'],
    ['quem-recebeu', 'Quem recebeu'],
    ['virou-obra', 'Virou obra'],
  ] as const;

  return (
    <main className="reportagem">
      <Topo
        chapeu={`Emendas · ${nomeDoTipoDeEmenda(emenda.tipo)}`}
        titulo={identificacaoDaEmenda(emenda)}
        linhaFina={
          <>
            De{' '}
            {autor.pessoaId ? (
              <Link href={`/parlamentares/${autor.pessoaId}`}>{autor.nome}</Link>
            ) : (
              autor.nome
            )}
            , {tipoEModalidade(emenda).toLowerCase()} ao orçamento de {emenda.ano}.
          </>
        }
        voltar={{ href: '/emendas', texto: 'Todas as emendas' }}
      >
        <p>
          Código {emenda.codigoNaFonte} no Portal da Transparência.
          {autor.pessoaId
            ? ' Autor identificado pelo nome: o Portal não traz outro identificador do parlamentar.'
            : ''}
        </p>
      </Topo>

      <FaixaDeNumeros
        itens={numerosDaEmenda({
          ano: emenda.ano,
          execucao: emenda.execucao,
          coletadaEm: emenda.fonte.coletadaEm,
        })}
      />

      <div className="reportagem__explicacoes">
        <p>Os valores são os acumulados até a coleta, somando todos os destinos da emenda.</p>
        <Explica termo="Emenda">{GLOSSARIO.emenda}</Explica>
        <Explica termo="Empenhado">{GLOSSARIO.empenhado}</Explica>
        <Explica termo="Pago">{GLOSSARIO.pago}</Explica>
      </div>

      <nav aria-label="Nesta página">
        <ul className="indice">
          {secoes.map(([id, titulo]) => (
            <li key={id}>
              <a href={`#${id}`}>{titulo}</a>
            </li>
          ))}
        </ul>
      </nav>

      <Secao
        id="reservado-e-pago"
        titulo="Quanto foi reservado e pago"
        periodo={periodo}
        fonte={<FonteDaSecao fonte={emenda.fonte} publicador="Portal da Transparência" />}
      >
        <p>
          {empenhado > 0n
            ? `${reaisResumidos(pago)} já foram pagos, de ${reaisResumidos(empenhado)} reservados no orçamento. Pago soma o que saiu no ano do orçamento e nos anos seguintes.`
            : 'Nenhum valor reservado no orçamento para esta emenda até a coleta.'}
        </p>
        {empenhado > 0n && <Proporcao partes={partesPagoEAPagar(pago, empenhado)} />}
        <Ranking itens={fasesDaEmenda(emenda.execucao)} />
        <p>
          O dinheiro anda em etapas: é reservado (empenhado), a entrega é conferida (liquidada) e só
          então sai do caixa (pago). O que não é pago no ano do orçamento passa para os anos
          seguintes.
        </p>
      </Secao>

      <Secao
        id="destino"
        titulo="Para onde foi"
        periodo={periodo}
        fonte={<FonteDaSecao fonte={emenda.fonte} publicador="Portal da Transparência" />}
      >
        <p>
          {`${plural(emenda.destinacoes.length, 'destino', 'destinos')}, cada um com a ação do orçamento que paga.`}
        </p>
        <ul className="linhas">
          {emenda.destinacoes.map((d) => (
            // A fonte não repete localidade com a mesma classificação: é a chave da destinação.
            <li
              key={`${d.localidade}|${d.funcao.codigo}|${d.subfuncao.codigo}|${d.programa.codigo}|${d.acao.codigo}|${d.planoOrcamentario.codigo}`}
              className="linha"
            >
              <p className="linha__chave">
                {d.municipioIbge ? (
                  <Link href={`/municipios/${d.municipioIbge}`}>{d.localidade}</Link>
                ) : (
                  d.localidade
                )}
              </p>
              <div className="linha__corpo">
                <p>
                  {d.acao.nome}
                  {d.modalidade ? ` · ${nomeDaModalidade(d.modalidade)}` : ''}
                </p>
                <p className="nota">
                  Empenhado {reais(d.execucao.empenhadoCentavos)} · pago até agora{' '}
                  {reais(pagoAteAgora(d.execucao))}
                </p>
                <p className="nota">
                  Ação {d.acao.codigo} · programa {classificacao(d.programa)} · função{' '}
                  {classificacao(d.funcao)} · subfunção {classificacao(d.subfuncao)}
                  {d.planoOrcamentario.codigo !== '0000'
                    ? ` · plano orçamentário ${classificacao(d.planoOrcamentario)}`
                    : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        id="quem-recebeu"
        titulo="Quem recebeu"
        periodo={periodoDosFavorecidos(favorecidos?.itens ?? [])}
        fonte={<FonteDaSecao fonte={favorecidos?.fonte} publicador="Portal da Transparência" />}
      >
        {favorecidos === null ? (
          <p>O Portal da Transparência ainda não registrou pagamentos desta emenda.</p>
        ) : (
          <>
            <Explica termo="Favorecido">{GLOSSARIO.favorecido}</Explica>
            <p>
              {`${reaisResumidos(favorecidos.recebidoCentavos)} recebidos por ${favorecidos.itens.length === 1 ? 'um favorecido' : `${NUMERO.format(favorecidos.itens.length)} favorecidos`}, de quem mais recebeu para quem menos.`}
            </p>
            <Favorecidos favorecidos={favorecidos} />
          </>
        )}
      </Secao>

      <Secao
        id="virou-obra"
        titulo="Virou obra"
        periodo={periodo}
        fonte={
          <FonteDaSecao
            fonte={obras[0]?.fonte ?? convenios[0]?.fonte}
            publicador="Obrasgov.br e Portal da Transparência"
          />
        }
      >
        {obras.length === 0 && convenios.length === 0 ? (
          <p>
            Nenhuma obra do Obrasgov.br nem convênio do Portal da Transparência ligado a esta
            emenda.
          </p>
        ) : (
          <>
            <p>
              {`${plural(obras.length, 'obra', 'obras')} com empenho desta emenda e ${plural(convenios.length, 'convênio', 'convênios')} que ela ajuda a pagar.`}
            </p>
            <div className="pilha">
              {obras.length > 0 && (
                <ul className="lista">
                  {obras.map((o) => (
                    <ItemDeObra key={o.obraId} obra={o} />
                  ))}
                </ul>
              )}
              {convenios.length > 0 && <Convenios convenios={convenios} />}
            </div>
          </>
        )}
      </Secao>
    </main>
  );
}
