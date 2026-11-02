import type { AutorNoMunicipio, ParlamentarResumo } from '@prometeu/contracts';
import { Chapeu, Explica, FaixaDeNumeros, Proporcao, Ranking, Secao } from '@prometeu/ui';
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
import { Acompanhar } from '../../_componentes/acompanhar';
import { ItemDeEmenda } from '../../_componentes/emendas';
import { FonteDaSecao } from '../../_componentes/fonte';
import { fonteMaisRecente } from '../../_componentes/fonte-mais-recente';
import {
  nomeDoCargo,
  partesPagoEAPagar,
  periodoDasEmendas,
  reais,
  reaisResumidos,
  NUMERO,
  plural,
} from '../../_componentes/formatacao';
import { GLOSSARIO } from '../../_componentes/glossario';
import { ItemDeObra, situacaoEMedicao } from '../../_componentes/obras';
import { numerosDaCidade } from './numeros';

interface Props {
  readonly params: Promise<{ codigoIbge: string }>;
  readonly searchParams: Promise<{ pagina?: string }>;
}

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

  const fonteDasEmendas = fonteMaisRecente(emendas);
  const fonteDasObras = fonteMaisRecente(obras);
  const periodoDasEmendasDaCidade = periodoDasEmendas(fonteDasEmendas?.coletadaEm ?? null);
  const periodoDasObras = periodoDasEmendas(fonteDasObras?.coletadaEm ?? null);
  const numeros = numerosDaCidade({
    pagoCentavos: pago,
    empenhadoCentavos: empenhado,
    emendas: quantasEmendas,
    obras: obras.total,
    emendasColetadasEm: fonteDasEmendas?.coletadaEm ?? null,
    obrasColetadasEm: fonteDasObras?.coletadaEm ?? null,
  });

  // O sumário só lista o que a página mostra.
  const secoes = [
    ['dinheiro', 'Quem mandou o dinheiro'],
    ['obras', 'Obras com dinheiro de emenda'],
    ['bancada', 'Quem representa a cidade no Congresso'],
    ...(obras.total > 8 ? [['todas-as-obras', 'Todas as obras']] : []),
    ['emendas', 'Todas as emendas'],
  ] as const;

  return (
    <main className="reportagem">
      <header className="reportagem__cabeca">
        <div className="reportagem__texto">
          <Chapeu>Cidade · {uf}</Chapeu>
          <h1>{nome}</h1>
          <div className="reportagem__acoes">
            <p className="reportagem__fina">
              O dinheiro federal que deputados e senadores indicaram para a cidade, as obras que ele
              pagou e quem a representa no Congresso.
            </p>
            <Acompanhar tipo="municipio" id={codigoIbge} volta={`/municipios/${codigoIbge}`} />
          </div>
        </div>
      </header>

      <FaixaDeNumeros itens={numeros} />
      <p className="reportagem__nota">
        Os números somam só a parte de cada emenda destinada a {nome}. As obras são as do
        Obrasgov.br com dinheiro de ao menos uma emenda.
      </p>

      <div className="reportagem__explicacoes">
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
        id="dinheiro"
        titulo="Quem mandou o dinheiro"
        periodo={periodoDasEmendasDaCidade}
        fonte={<FonteDaSecao fonte={fonteDasEmendas} publicador="Portal da Transparência" />}
      >
        {autores.length === 0 ? (
          <p>Nenhuma emenda com destino a {nome} coletada.</p>
        ) : (
          <>
            <p>
              {`${reaisResumidos(pago)} já foram pagos, de ${reaisResumidos(empenhado)} reservados no orçamento, em ${plural(quantasEmendas, 'emenda', 'emendas')} com destino a ${nome}.`}
            </p>
            <Proporcao partes={partesPagoEAPagar(pago, empenhado)} />
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
                  `${plural(a.emendas, 'emenda', 'emendas')}, ${reaisResumidos(a.empenhadoCentavos)} reservados`,
                ].join(' · '),
                valor: Number(BigInt(a.pagoCentavos) / 100n),
                texto: `${reaisResumidos(a.pagoCentavos)} pagos`,
              }))}
            />
            <p>
              Conta só a parte de cada emenda destinada a {nome}; a que foi para o estado inteiro ou
              para várias cidades de uma vez não entra. Pago soma o que saiu no ano do orçamento e
              nos anos seguintes. O partido é o atual do parlamentar, não o da época da emenda.
            </p>
          </>
        )}
      </Secao>

      <Secao
        id="obras"
        titulo="Obras com dinheiro de emenda"
        periodo={periodoDasObras}
        fonte={<FonteDaSecao fonte={fonteDasObras} publicador="Obrasgov.br" />}
      >
        {obras.total === 0 ? (
          <p>Nenhuma obra com dinheiro de emenda coletada em {nome}.</p>
        ) : (
          <>
            <p>
              {`${plural(obras.total, 'obra', 'obras')} com dinheiro de emenda em ${nome}: ${plural(concluidas, 'concluída', 'concluídas')}, ${NUMERO.format(emExecucao)} em execução e ${plural(paralisadas, 'paralisada', 'paralisadas')}.`}
            </p>
            <Explica termo="Situação da obra">{GLOSSARIO.situacaoDaObra}</Explica>
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
            <ul className="fichas">
              {obras.itens.slice(0, 8).map((o) => (
                <li key={o.obraId} className="ficha">
                  <Link href={`/obras/${o.obraId}`} className="ficha__titulo">
                    {o.nome}
                  </Link>
                  <p className="ficha__nota">
                    {situacaoEMedicao(o)} · {reais(o.investimentoPrevistoCentavos)} previstos
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>

      <Secao
        id="bancada"
        titulo="Quem representa a cidade no Congresso"
        periodo="em exercício hoje"
        fonte={
          bancada.itens.length === 0 ? (
            <FonteDaSecao publicador="Câmara dos Deputados e Senado Federal" />
          ) : (
            <p className="fonte">Fonte: Câmara dos Deputados e Senado Federal.</p>
          )
        }
      >
        <p>
          {`${plural(senadores.length, 'senador', 'senadores')} e ${plural(deputados.length, 'deputado federal', 'deputados federais')} eleitos por ${uf} estão em exercício.`}
        </p>
        <p>
          A cidade vota para deputado federal e senador junto com o estado inteiro: quem a
          representa no Congresso é a bancada de {uf}.
        </p>
        <Bancada titulo="No Senado" pessoas={senadores} />
        <Bancada titulo="Na Câmara" pessoas={deputados} />
      </Secao>

      {obras.total > 8 && (
        <Secao
          id="todas-as-obras"
          titulo="Todas as obras"
          periodo={periodoDasObras}
          fonte={<FonteDaSecao fonte={fonteDasObras} publicador="Obrasgov.br" />}
        >
          <p>
            {obras.itens.length === obras.total
              ? `As ${NUMERO.format(obras.total)} obras com dinheiro de emenda em ${nome}.`
              : `As ${NUMERO.format(obras.itens.length)} maiores obras, de ${NUMERO.format(obras.total)} com dinheiro de emenda.`}
          </p>
          <ul className="lista">
            {obras.itens.map((o) => (
              <ItemDeObra key={o.obraId} obra={o} />
            ))}
          </ul>
        </Secao>
      )}

      <Secao
        id="emendas"
        titulo="Todas as emendas"
        periodo={periodoDasEmendasDaCidade}
        fonte={<FonteDaSecao fonte={fonteDasEmendas} publicador="Portal da Transparência" />}
      >
        <p>
          {`${plural(emendas.total, 'emenda', 'emendas')} com destino a ${nome}.`}{' '}
          <span className="nota">
            Valores da emenda inteira, que pode ter ido também para outros lugares.
          </span>
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
      </Secao>
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
    <div className="pilha" role="group" aria-label={titulo}>
      <h3 className="titulo-de-lista">{titulo}</h3>
      <ul className="nomes">
        {pessoas.map((p) => (
          <li key={p.pessoaId}>
            <Link href={`/parlamentares/${p.pessoaId}`}>{p.nome}</Link>{' '}
            <span className="nota">{p.siglaPartido ?? 'sem partido'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
