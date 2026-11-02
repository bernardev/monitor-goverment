import type { ObraDetalhada, ObraResumo, VotacaoNominalResumo } from '@prometeu/contracts';
import { Chamada, Chapeu, Explica, FaixaDeNumeros, Proporcao, Secao } from '@prometeu/ui';
import type { NumeroChave } from '@prometeu/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  autoresNoMunicipio,
  buscarObra,
  listarEmendas,
  listarObras,
  listarVotacoes,
  situacaoDasFontes,
} from './_api/cliente';
import {
  dataPorExtenso,
  fraseDaInterrupcao,
  juntarFrases,
  periodoDaPresenca,
  resumirTexto,
  rotuloDeEmendas,
  rotuloDeObras,
  tituloDaManchete,
} from './_componentes/capa';
import { DataDoDia } from './_componentes/data-do-dia';
import { Fonte, FonteEmLinha } from './_componentes/fonte';
import { fonteMaisRecente } from './_componentes/fonte-mais-recente';
import {
  comContagem,
  dia,
  nomeDoResultado,
  periodoDasEmendas,
  reaisResumidos,
} from './_componentes/formatacao';
import { GLOSSARIO } from './_componentes/glossario';
import { lugarDaObra, situacaoEMedicao } from './_componentes/obras';
import { partesDoPlacar } from './_componentes/placar';

/** A cidade de exemplo da coluna: Porto Alegre (RS). */
const CIDADE_DE_EXEMPLO = { codigoIbge: '4314902', nome: 'Porto Alegre', uf: 'RS' } as const;

/** Um pedaço da capa que falha não derruba a página: o bloco dele só some. */
function tentar<T>(promessa: Promise<T>): Promise<T | undefined> {
  return promessa.catch(() => undefined);
}

export default async function PaginaInicial(): Promise<ReactNode> {
  const [votacoes, paralisadas, emendas, obras, concluidas, autoresDoExemplo, fontes] =
    await Promise.all([
      tentar(listarVotacoes(1)),
      tentar(listarObras({ situacao: 'paralisada', pagina: 1, itens: 1 })),
      tentar(listarEmendas({ pagina: 1 })),
      tentar(listarObras({ pagina: 1, itens: 1 })),
      tentar(listarObras({ situacao: 'concluida', pagina: 1, itens: 1 })),
      tentar(autoresNoMunicipio(CIDADE_DE_EXEMPLO.codigoIbge)),
      tentar(situacaoDasFontes()),
    ]);
  const obraParada = paralisadas?.itens[0];
  const detalheDaObra = obraParada ? await tentar(buscarObra(obraParada.obraId)) : undefined;
  const votacao = votacoes?.itens[0];

  const fonteDasEmendas = fonteMaisRecente(emendas);
  const fonteDasObras = fonteMaisRecente(obras);
  const periodoDasEmendasNoSite = periodoDasEmendas(fonteDasEmendas?.coletadaEm ?? null);
  const periodoDaChamada = periodoDaPresenca(fontes);
  const pagoNoExemplo = autoresDoExemplo?.reduce((soma, a) => soma + BigInt(a.pagoCentavos), 0n);

  const numeros: NumeroChave[] = [];
  if (emendas && emendas.total > 0) {
    numeros.push({
      ...comContagem(emendas.total),
      rotulo: rotuloDeEmendas(emendas.total),
      periodo: periodoDasEmendasNoSite,
    });
  }
  if (concluidas && obras) {
    numeros.push({
      ...comContagem(concluidas.total),
      rotulo: rotuloDeObras(concluidas.total, obras.total),
      periodo: periodoDasEmendas(fonteDasObras?.coletadaEm ?? null),
    });
  }

  return (
    <main className="reportagem capa">
      <h1 className="oculto">Prometeu: o que o governo federal prometeu e fez</h1>
      <p className="capa__topo">
        <DataDoDia inicial={dataPorExtenso(new Date())} />
        <span>O que cada político prometeu e o que fez depois, com a fonte de cada fato.</span>
      </p>

      <div className="capa__miolo">
        <div className="capa__destaques">
          <h2 className="oculto">Destaques</h2>
          {votacao ? (
            <Manchete votacao={votacao} />
          ) : (
            <p>As votações não estão disponíveis agora. Tente de novo em alguns minutos.</p>
          )}

          <div className="capa__secundarias">
            {obraParada && <ChamadaDaObra obra={obraParada} detalhe={detalheDaObra} />}
            <Chamada
              tamanho="secundaria"
              chapeu="Presença"
              titulo="Faltas com o motivo dado à Câmara, dia a dia"
              href="/parlamentares"
              linhaFina={
                <>
                  Cada deputado tem a presença nas sessões da Câmara registrada, e a falta
                  justificada traz o motivo aceito pela Casa. Escolha um deputado para ver.
                </>
              }
              fonte={`Fonte: Câmara dos Deputados${periodoDaChamada ? `, ${periodoDaChamada}` : ''}.`}
            />
          </div>
        </div>

        <aside className="capa__coluna" aria-label="Sua cidade e os totais">
          <Secao
            id="sua-cidade"
            titulo="O que chegou à sua cidade"
            {...(fonteDasEmendas ? { fonte: <Fonte fonte={fonteDasEmendas} /> } : {})}
          >
            <form method="get" action="/busca" role="search" className="busca">
              <label htmlFor="q" className="oculto">
                Nome da sua cidade
              </label>
              <input
                id="q"
                name="q"
                type="search"
                minLength={2}
                required
                placeholder="Digite sua cidade"
              />
              <button type="submit" className="botao">
                Buscar
              </button>
            </form>
            {fonteDasEmendas && pagoNoExemplo !== undefined && pagoNoExemplo > 0n && (
              <div className="capa__exemplo">
                <Chapeu>Por exemplo</Chapeu>
                <Link href={`/municipios/${CIDADE_DE_EXEMPLO.codigoIbge}`}>
                  {CIDADE_DE_EXEMPLO.nome} ({CIDADE_DE_EXEMPLO.uf})
                </Link>
                <span>
                  {reaisResumidos(pagoNoExemplo)} pagos em emendas, {periodoDasEmendasNoSite}.
                </span>
              </div>
            )}
            <Explica termo="Emenda">{GLOSSARIO.emenda}</Explica>
            <Explica termo="Pago">{GLOSSARIO.pago}</Explica>
          </Secao>

          {numeros.length > 0 && (
            <Secao
              id="em-numeros"
              titulo="O site em números"
              fonte={
                <>
                  {fonteDasEmendas && <Fonte fonte={fonteDasEmendas} />}
                  {fonteDasObras && <Fonte fonte={fonteDasObras} />}
                </>
              }
            >
              <FaixaDeNumeros itens={numeros} />
            </Secao>
          )}
        </aside>
      </div>

      <Secao id="por-onde-comecar" titulo="Por onde começar">
        <div className="capa__entradas">
          <Chamada
            tamanho="lista"
            chapeu="Meu governo"
            titulo="Sua cidade"
            href="/municipios"
            linhaFina="Quem a representa no Congresso, o dinheiro de emenda que chegou e as obras que ele pagou."
          />
          <Chamada
            tamanho="lista"
            chapeu="Parlamentares"
            titulo="Deputados e senadores"
            href="/parlamentares"
            linhaFina="Presença, votos, proposições e emendas de cada um."
          />
          <Chamada
            tamanho="lista"
            chapeu="Votações"
            titulo="Votações nominais"
            href="/votacoes"
            linhaFina="Votações dos últimos 90 dias, com o voto de cada parlamentar."
          />
          <Chamada
            tamanho="lista"
            chapeu="Proposições"
            titulo="Propostas de lei"
            href="/proposicoes"
            linhaFina="O que a Câmara e o Senado têm em votação, com a tramitação."
          />
          <Chamada
            tamanho="lista"
            chapeu="Emendas"
            titulo="Emendas ao orçamento"
            href="/emendas"
            linhaFina="Quem indicou, para onde foi e quanto já foi pago."
          />
          <Chamada
            tamanho="lista"
            chapeu="Obras"
            titulo="Obras com dinheiro de emenda"
            href="/obras"
            linhaFina="A situação e a medição de cada uma, da maior para a menor."
          />
          <Chamada
            tamanho="lista"
            chapeu="Fontes"
            titulo="Situação das fontes"
            href="/fontes"
            linhaFina="A última coleta de cada fonte oficial e se a agenda está em dia."
          />
        </div>
      </Secao>
    </main>
  );
}

/** A votação mais recente: o placar em barra, o que foi votado e o caminho para o voto de cada um. */
function Manchete({ votacao }: { votacao: VotacaoNominalResumo }): ReactNode {
  const camara = votacao.casa === 'camara_dos_deputados';
  const ementa = votacao.proposicoes[0]?.ementa;
  const resultado =
    votacao.resultado === 'nao_informado'
      ? ''
      : `Resultado: ${nomeDoResultado(votacao.resultado).toLowerCase()}`;
  return (
    <div className="capa__manchete">
      <Chamada
        tamanho="manchete"
        chapeu={`Votações · ${camara ? 'Câmara' : 'Senado'}`}
        titulo={tituloDaManchete(votacao)}
        href={`/votacoes/${votacao.votacaoId}`}
        linhaFina={
          <>
            {juntarFrases(
              `Votação nominal de ${dia(votacao.dia)}`,
              resultado,
              `Nas palavras ${camara ? 'da Câmara' : 'do Senado'}: ${votacao.descricao}`,
              ementa ? `Sobre o projeto: ${resumirTexto(ementa, 200)}` : '',
            )}{' '}
            <Link href={`/votacoes/${votacao.votacaoId}`}>
              Veja como votou cada {camara ? 'deputado' : 'senador'}.
            </Link>
          </>
        }
      />
      <Proporcao partes={partesDoPlacar(votacao)} />
      <Explica termo="Votação nominal">{GLOSSARIO.votacaoNominal}</Explica>
      <Fonte fonte={votacao.fonte} />
    </div>
  );
}

/** A maior obra paralisada entre as com dinheiro de emenda, com o motivo que a fonte informa. */
function ChamadaDaObra({
  obra,
  detalhe,
}: {
  obra: ObraResumo;
  detalhe: ObraDetalhada | undefined;
}): ReactNode {
  return (
    <Chamada
      tamanho="secundaria"
      chapeu="Obra · com dinheiro de emenda"
      titulo={`Obra de ${reaisResumidos(obra.investimentoPrevistoCentavos)} em ${lugarDaObra(obra)} está paralisada`}
      href={`/obras/${obra.obraId}`}
      linhaFina={juntarFrases(
        obra.nome,
        situacaoEMedicao(obra),
        fraseDaInterrupcao(detalhe?.interrupcoes ?? []),
      )}
      fonte={<FonteEmLinha fonte={obra.fonte} />}
    />
  );
}
