import type { ClassificacaoOrcamentaria, ExecucaoDaEmenda } from '@prometeu/contracts';
import { Capitulo, Cifra, type ItemDoRanking, Ranking } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarEmenda } from '../../_api/cliente';
import { identificacaoDaEmenda, tipoEModalidade } from '../../_componentes/emendas';
import { Convenios, Favorecidos } from '../../_componentes/favorecidos';
import { Fonte } from '../../_componentes/fonte';
import {
  nomeDaModalidade,
  pagoAteAgora,
  percentual,
  reais,
  reaisResumidos,
} from '../../_componentes/formatacao';
import { ItemDeObra } from '../../_componentes/obras';
import { Topo } from '../../_componentes/topo';

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

/** As fases da despesa, na ordem em que o dinheiro anda, cada uma contra o empenhado. */
function fases(execucao: ExecucaoDaEmenda): ItemDoRanking[] {
  const fase = (chave: string, rotulo: string, centavos: string | bigint, detalhe?: string) => ({
    chave,
    rotulo,
    ...(detalhe === undefined ? {} : { detalhe }),
    valor: Number(BigInt(centavos) / 100n),
    texto: reais(centavos),
  });
  return [
    fase('empenhado', 'Empenhado', execucao.empenhadoCentavos, 'O dinheiro reservado'),
    fase('liquidado', 'Liquidado', execucao.liquidadoCentavos, 'A entrega verificada'),
    fase('pago', 'Pago no ano do orçamento', execucao.pagoCentavos),
    fase('restos', 'Restos a pagar inscritos', execucao.restosInscritosCentavos),
    fase('cancelados', 'Restos cancelados', execucao.restosCanceladosCentavos),
    fase('restos-pagos', 'Restos pagos depois', execucao.restosPagosCentavos),
    fase('total', 'Pago até agora', pagoAteAgora(execucao), 'No ano e depois'),
  ];
}

export default async function PaginaDaEmenda({ params }: Props): Promise<ReactNode> {
  const emenda = await buscarEmenda((await params).emendaId);
  if (!emenda) notFound();
  const empenhado = BigInt(emenda.execucao.empenhadoCentavos);
  const pago = pagoAteAgora(emenda.execucao);
  const centesimos = empenhado > 0n ? Number((pago * 10000n) / empenhado) : 0;
  const { autor, favorecidos, convenios, obras } = emenda;

  return (
    <main className="capitulos">
      <Topo
        titulo={identificacaoDaEmenda(emenda)}
        voltar={{ href: '/emendas', texto: 'Todas as emendas' }}
        aoLado={
          <Cifra
            valor={percentual(centesimos)}
            legenda={`do valor empenhado já foi pago: ${reaisResumidos(pago)} de ${reaisResumidos(empenhado)}.`}
          />
        }
      >
        <p className="destaque">
          De{' '}
          {autor.pessoaId ? (
            <Link href={`/parlamentares/${autor.pessoaId}`}>{autor.nome}</Link>
          ) : (
            autor.nome
          )}
          , {tipoEModalidade(emenda).toLowerCase()} ao orçamento de {emenda.ano}.
        </p>
        <p className="nota">
          Código {emenda.codigoNaFonte} no Portal da Transparência.
          {autor.pessoaId
            ? ' Autor identificado pelo nome: o Portal não traz outro identificador do parlamentar.'
            : ''}
        </p>
        <Fonte fonte={emenda.fonte} />
      </Topo>

      <Capitulo
        id="pagou"
        campo="areia"
        verbo="Pagou."
        frase={`${reaisResumidos(pago)} dos ${reaisResumidos(empenhado)} empenhados, somado o que ficou para os anos seguintes.`}
        nota={
          <p>
            Valores acumulados até a coleta. Empenho é a reserva do dinheiro; liquidação, a
            verificação de que a entrega aconteceu; pagamento, a saída do caixa. O que não é pago no
            ano vira restos a pagar.
          </p>
        }
      >
        <Ranking itens={fases(emenda.execucao)} />
      </Capitulo>

      <Capitulo
        id="destinou"
        campo="papel"
        verbo="Destinou."
        frase={`${String(emenda.destinacoes.length)} ${emenda.destinacoes.length === 1 ? 'destino' : 'destinos'}, cada um com a ação do orçamento que paga.`}
      >
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
      </Capitulo>

      <Capitulo
        id="chegou-a"
        campo="areia"
        verbo="Chegou a."
        frase={
          favorecidos === null
            ? 'O Portal da Transparência ainda não registrou pagamentos desta emenda.'
            : `${reaisResumidos(favorecidos.recebidoCentavos)} recebidos por ${favorecidos.itens.length === 1 ? 'um favorecido' : `${String(favorecidos.itens.length)} favorecidos`}, de quem mais recebeu para quem menos.`
        }
      >
        {favorecidos !== null && <Favorecidos favorecidos={favorecidos} />}
      </Capitulo>

      <Capitulo
        id="virou-obra"
        campo="papel"
        verbo="Virou obra."
        frase={
          obras.length === 0 && convenios.length === 0
            ? 'Nenhuma obra do Obrasgov nem convênio do Portal da Transparência ligado a esta emenda.'
            : `${String(obras.length)} ${obras.length === 1 ? 'obra' : 'obras'} com empenho desta emenda e ${String(convenios.length)} ${convenios.length === 1 ? 'convênio' : 'convênios'} que ela ajuda a pagar.`
        }
      >
        {(obras.length > 0 || convenios.length > 0) && (
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
        )}
      </Capitulo>
    </main>
  );
}
