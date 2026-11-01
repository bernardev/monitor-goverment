import type { AutorNoMunicipio, ParlamentarResumo } from '@prometeu/contracts';
import { Capitulo, Cifra, Proporcao, Ranking } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  autoresNoMunicipio,
  buscarMunicipio,
  listarEmendas,
  listarObras,
  listarParlamentares,
} from '../../_api/cliente';
import { ItemDeEmenda } from '../../_componentes/emendas';
import {
  nomeDaSituacaoDaObra,
  nomeDoCargo,
  percentual,
  reaisEmEscala,
  partesPagoEAPagar,
  reaisResumidos,
} from '../../_componentes/formatacao';
import { ItemDeObra } from '../../_componentes/obras';

interface Props {
  readonly params: Promise<{ codigoIbge: string }>;
  readonly searchParams: Promise<{ pagina?: string }>;
}

const NUMERO = new Intl.NumberFormat('pt-BR');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const municipio = await buscarMunicipio((await params).codigoIbge);
  return {
    title: municipio
      ? `Meu governo: ${municipio.nome} - ${municipio.uf} | Prometeu`
      : 'Município não encontrado | Prometeu',
  };
}

function soma(autores: readonly AutorNoMunicipio[], campo: 'empenhadoCentavos' | 'pagoCentavos') {
  return autores.reduce((total, a) => total + BigInt(a[campo]), 0n);
}

/** `deputados federais` ou `deputado federal`, conforme a contagem. */
function plural(n: number, um: string, varios: string): string {
  return `${NUMERO.format(n)} ${n === 1 ? um : varios}`;
}

export default async function MeuGoverno({ params, searchParams }: Props): Promise<ReactNode> {
  const { codigoIbge } = await params;
  const municipio = await buscarMunicipio(codigoIbge);
  if (!municipio) notFound();
  const pagina = Math.max(1, Number.parseInt((await searchParams).pagina ?? '1', 10) || 1);
  const contagem = (situacao: 'concluida' | 'em_execucao' | 'paralisada') =>
    listarObras({ municipio: codigoIbge, situacao, pagina: 1, itens: 1 }).then((p) => p.total);
  const [autores, bancada, emendas, obras, concluidas, emExecucao, paralisadas] = await Promise.all(
    [
      autoresNoMunicipio(codigoIbge),
      listarParlamentares({ uf: municipio.uf, pagina: 1, itens: 100 }),
      listarEmendas({ municipio: codigoIbge, pagina }),
      listarObras({ municipio: codigoIbge, pagina: 1, itens: 100 }),
      contagem('concluida'),
      contagem('em_execucao'),
      contagem('paralisada'),
    ],
  );
  const { nome, uf } = municipio;
  const empenhado = soma(autores, 'empenhadoCentavos');
  const pago = soma(autores, 'pagoCentavos');
  const quantasEmendas = autores.reduce((total, a) => total + a.emendas, 0);
  const senadores = bancada.itens.filter((p) => p.cargo === 'senador');
  const deputados = bancada.itens.filter((p) => p.cargo !== 'senador');
  const ultimaPagina = Math.max(1, Math.ceil(emendas.total / emendas.itensPorPagina));
  const endereco = (outra: number) => `/municipios/${codigoIbge}?pagina=${String(outra)}#emendas`;

  return (
    <main className="capitulos">
      <section className="retrato" data-campo="papel" aria-labelledby="nome">
        <div className="retrato__miolo">
          <div className="retrato__texto">
            <h1 id="nome" className="retrato__nome">
              {nome}
            </h1>
            <p className="destaque">
              {uf}. Quem representa a cidade no Congresso, o dinheiro de emenda que chegou aqui e as
              obras que ele pagou.
            </p>
            <nav aria-label="Nesta página">
              <ul className="sumario">
                <li>
                  <a href="#recebeu">Recebeu</a>
                </li>
                <li>
                  <a href="#virou-obra">Virou obra</a>
                </li>
                <li>
                  <a href="#representam">Representam</a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="retrato__lado">
            <Cifra
              valor={`R$ ${reaisEmEscala(pago).numero}`}
              legenda={
                autores.length === 0
                  ? 'Nenhuma emenda com destino à cidade coletada ainda.'
                  : `${reaisEmEscala(pago).escala || 'reais'} pagos em emendas com destino a ${nome} desde 2023.`
              }
            />
          </div>
        </div>
      </section>

      {autores.length === 0 ? (
        <Capitulo
          id="recebeu"
          campo="areia"
          verbo="Recebeu."
          frase={`Nenhuma emenda com destino a ${nome} coletada desde o orçamento de 2023.`}
        />
      ) : (
        <Capitulo
          id="recebeu"
          campo="areia"
          verbo="Recebeu."
          frase={`${reaisResumidos(pago)} pagos de ${reaisResumidos(empenhado)} empenhados, em ${plural(quantasEmendas, 'emenda', 'emendas')} com destino a ${nome}.`}
          aoLado={<Proporcao partes={partesPagoEAPagar(pago, empenhado)} />}
          nota={
            <p>
              Conta só a parte de cada emenda destinada a {nome}; a que foi para a UF inteira ou
              para vários municípios de uma vez não entra. Pago soma o pago no ano do orçamento e os
              restos a pagar pagos depois. O partido é o atual do parlamentar, não o da época da
              emenda.
            </p>
          }
        >
          <h3 className="titulo-de-lista">Quem mandou o dinheiro</h3>
          <Ranking
            itens={autores.map((a) => ({
              chave: a.pessoaId ?? a.nome,
              rotulo: a.pessoaId ? (
                <Link href={`/parlamentares/${a.pessoaId}`}>{a.nome}</Link>
              ) : (
                a.nome
              ),
              detalhe: [
                a.pessoaId
                  ? [a.siglaPartido, nomeDoCargo(a.cargo)].filter(Boolean).join(' · ')
                  : 'Emenda coletiva',
                `${plural(a.emendas, 'emenda', 'emendas')}, ${reaisResumidos(a.empenhadoCentavos)} empenhados`,
              ].join(' · '),
              valor: Number(BigInt(a.pagoCentavos) / 100n),
              texto: `${reaisResumidos(a.pagoCentavos)} pagos`,
            }))}
          />
        </Capitulo>
      )}

      {obras.total === 0 ? (
        <Capitulo
          id="virou-obra"
          campo="papel"
          verbo="Virou obra."
          frase={`Nenhuma obra paga com emenda coletada em ${nome}.`}
        />
      ) : (
        <Capitulo
          id="virou-obra"
          campo="papel"
          verbo="Virou obra."
          frase={`${plural(obras.total, 'obra paga', 'obras pagas')} com emendas em ${nome}: ${NUMERO.format(concluidas)} concluídas, ${NUMERO.format(emExecucao)} em execução, ${NUMERO.format(paralisadas)} paralisadas.`}
          aoLado={
            <Proporcao
              partes={[
                { rotulo: 'concluídas', valor: concluidas, tom: 'forte' },
                { rotulo: 'em execução', valor: emExecucao, tom: 'medio' },
                { rotulo: 'paralisadas', valor: paralisadas, tom: 'fraco' },
                {
                  rotulo: 'planejadas ou outras',
                  valor: obras.total - concluidas - emExecucao - paralisadas,
                  tom: 'vazio',
                },
              ]}
            />
          }
          nota={
            <p>Obras do Obrasgov pagas por ao menos uma emenda. Situação e medição da fonte.</p>
          }
        >
          <ul className="linhas">
            {obras.itens.slice(0, 8).map((o) => (
              <li key={o.obraId} className="linha">
                <p className="linha__chave">{nomeDaSituacaoDaObra(o.situacao)}</p>
                <div className="linha__corpo">
                  <Link href={`/obras/${o.obraId}`}>{o.nome}</Link>
                  <p className="nota">
                    {reaisResumidos(o.investimentoPrevistoCentavos)} previstos
                    {o.medicao ? ` · ${percentual(o.medicao.percentualCentesimos)} executado` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Capitulo>
      )}

      <Capitulo
        id="representam"
        campo="aco"
        verbo="Representam."
        frase={`${plural(senadores.length, 'senador', 'senadores')} e ${plural(deputados.length, 'deputado federal', 'deputados federais')} eleitos por ${uf} estão em exercício.`}
        nota={
          <p>
            A cidade vota para deputado federal e senador junto com o estado inteiro: quem a
            representa no Congresso é a bancada de {uf}.
          </p>
        }
      >
        <div className="pilha">
          <Bancada titulo="No Senado" pessoas={senadores} />
          <Bancada titulo="Na Câmara" pessoas={deputados} />
        </div>
      </Capitulo>

      <section className="apendice" data-campo="papel" aria-labelledby="tudo">
        <h2 id="tudo" className="titulo">
          Tudo o que chegou
        </h2>
        {obras.total > 8 && (
          <section aria-labelledby="todas-as-obras" className="pilha">
            <h3 id="todas-as-obras" className="titulo-de-lista">
              As {NUMERO.format(obras.itens.length)} maiores obras
            </h3>
            <ul className="lista">
              {obras.itens.map((o) => (
                <ItemDeObra key={o.obraId} obra={o} />
              ))}
            </ul>
          </section>
        )}
        <section id="emendas" aria-labelledby="todas-as-emendas" className="pilha">
          <h3 id="todas-as-emendas" className="titulo-de-lista">
            {plural(emendas.total, 'emenda', 'emendas')} com destino a {nome}
          </h3>
          <p className="nota">
            Valores da emenda inteira, que pode ter ido também para outros lugares.
          </p>
          <ul className="lista">
            {emendas.itens.map((e) => (
              <ItemDeEmenda key={e.emendaId} emenda={e} />
            ))}
          </ul>
          {ultimaPagina > 1 && (
            <nav aria-label="Paginação" className="paginacao">
              {pagina > 1 && <Link href={endereco(pagina - 1)}>Anterior</Link>}
              <span>
                Página {pagina} de {ultimaPagina}
              </span>
              {pagina < ultimaPagina && <Link href={endereco(pagina + 1)}>Próxima</Link>}
            </nav>
          )}
        </section>
      </section>
    </main>
  );
}

function Bancada({
  titulo,
  pessoas,
}: {
  titulo: string;
  pessoas: readonly ParlamentarResumo[];
}): ReactNode {
  if (pessoas.length === 0) return null;
  return (
    <section className="pilha" aria-label={titulo}>
      <h3 className="titulo-de-lista">{titulo}</h3>
      <ul className="nomes">
        {pessoas.map((p) => (
          <li key={p.pessoaId}>
            <Link href={`/parlamentares/${p.pessoaId}`}>{p.nome}</Link>{' '}
            <span className="nota">{p.siglaPartido ?? 'sem partido'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
