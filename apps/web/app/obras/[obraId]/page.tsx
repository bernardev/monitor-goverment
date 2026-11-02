import { Explica, FaixaDeNumeros, Proporcao, Secao } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarObra } from '../../_api/cliente';
import { FonteDaSecao } from '../../_componentes/fonte';
import {
  cnpj,
  dia,
  nomeDaSituacaoDaObra,
  NUMERO,
  percentual,
  periodoDasEmendas,
  reais,
  reaisResumidos,
} from '../../_componentes/formatacao';
import { GLOSSARIO } from '../../_componentes/glossario';
import { lugarDaObra, situacaoEMedicao } from '../../_componentes/obras';
import { Topo } from '../../_componentes/topo';
import { nomeCabeNoTitulo, numerosDaObra, periodoAteAColeta } from './numeros';

interface Props {
  readonly params: Promise<{ obraId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const obra = await buscarObra((await params).obraId);
  return { title: obra ? `${obra.nome} | Prometeu` : 'Obra não encontrada | Prometeu' };
}

const INTERRUPCOES: Readonly<Record<string, string>> = {
  paralisada: 'Paralisada',
  cancelada: 'Cancelada',
  inacabada: 'Declarada inacabada',
};

/** A fonte costuma repetir o nome na descrição, às vezes com outra caixa ou um ponto final. */
function mesmoTexto(a: string, b: string): boolean {
  const limpo = (t: string) => t.trim().replace(/\.$/, '').toLocaleLowerCase('pt-BR');
  return limpo(a) === limpo(b);
}

function periodo(inicio: string | null, fim: string | null): string {
  if (inicio === null && fim === null) return 'não informado';
  return `${inicio ? dia(inicio) : '?'} a ${fim ? dia(fim) : '?'}`;
}

export default async function PaginaDaObra({ params }: Props): Promise<ReactNode> {
  const obra = await buscarObra((await params).obraId);
  if (!obra) notFound();
  const { medicao, interrupcoes, emendas, executores } = obra;
  const ateAColeta = periodoAteAColeta(obra.fonte.coletadaEm);
  const fonte = <FonteDaSecao fonte={obra.fonte} publicador="Obrasgov.br" />;
  // Nome oficial comprido não cabe num título de duas linhas no telefone: o título diz onde é a obra
  // e o nome oficial vem inteiro logo abaixo.
  const nomeLongo = !nomeCabeNoTitulo(obra.nome);
  const tipo = [obra.natureza, obra.especie].filter((parte) => parte !== null).join(' · ');
  const onde = (
    <>
      {tipo ? `${tipo} em ` : 'Em '}
      {obra.municipios.length === 0
        ? lugarDaObra(obra)
        : obra.municipios.map((m, n) => (
            <span key={m.codigoIbge}>
              {n > 0 ? ', ' : ''}
              <Link href={`/municipios/${m.codigoIbge}`}>{m.nome ?? m.codigoIbge}</Link>
            </span>
          ))}
      {obra.uf && obra.municipios.length > 0 ? ` - ${obra.uf}` : ''}.
    </>
  );
  const secoes = [
    ['andamento', 'Andamento'],
    ['paradas', 'Paradas, se houve'],
    ['reservado', 'Dinheiro de emenda reservado para a obra'],
  ] as const;

  return (
    <main className="reportagem">
      <Topo
        chapeu={`Obras · ${nomeDaSituacaoDaObra(obra.situacao)}`}
        titulo={nomeLongo ? `Obra em ${lugarDaObra(obra)}` : obra.nome}
        linhaFina={nomeLongo ? obra.nome : onde}
        voltar={{ href: '/obras', texto: 'Todas as obras' }}
      >
        {nomeLongo && <p>{onde}</p>}
        {obra.descricao && !mesmoTexto(obra.descricao, obra.nome) && <p>{obra.descricao}</p>}
        <p>
          Projeto {obra.idNaFonte} no Obrasgov.br, o cadastro federal de obras e projetos de
          investimento.{obra.endereco ? ` Endereço: ${obra.endereco}.` : ''}
        </p>
      </Topo>

      <FaixaDeNumeros
        itens={numerosDaObra({
          medicao,
          investimentoPrevistoCentavos: obra.investimentoPrevistoCentavos,
          emendas,
          coletadaEm: obra.fonte.coletadaEm,
        })}
      />

      <div className="reportagem__explicacoes">
        <p>A execução é a física, informada ao Obrasgov.br, e não o dinheiro pago.</p>
        <Explica termo="Situação da obra">{GLOSSARIO.situacaoDaObra}</Explica>
        <Explica termo="Emenda">{GLOSSARIO.emenda}</Explica>
        <Explica termo="Empenhado">{GLOSSARIO.empenhado}</Explica>
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
        id="andamento"
        titulo="Andamento"
        periodo={medicao?.em ? `medição de ${dia(medicao.em)}` : ateAColeta}
        fonte={fonte}
      >
        <p>
          {`${situacaoEMedicao(obra)}. Investimento previsto de ${reaisResumidos(obra.investimentoPrevistoCentavos)}.`}
        </p>
        {medicao !== null && (
          <Proporcao
            partes={[
              {
                rotulo: 'executado',
                valor: medicao.percentualCentesimos,
                tom: 'forte',
                texto: `${percentual(medicao.percentualCentesimos)} executado`,
              },
              {
                rotulo: 'por executar',
                valor: Math.max(0, 10000 - medicao.percentualCentesimos),
                tom: 'vazio',
                texto: 'por executar',
              },
            ]}
          />
        )}
        {medicao === null && <p>O Obrasgov.br ainda não registra execução física desta obra.</p>}
        <dl className="resumo">
          <dt>Prazo previsto</dt>
          <dd>{periodo(obra.inicioPrevisto, obra.fimPrevisto)}</dd>
          <dt>Execução</dt>
          <dd>{periodo(obra.inicioEfetivo, obra.fimEfetivo)}</dd>
          <dt>Investimento previsto</dt>
          <dd>{reais(obra.investimentoPrevistoCentavos)}</dd>
          {executores.length > 0 && (
            <>
              <dt>{executores.length === 1 ? 'Executora' : 'Executoras'}</dt>
              <dd className="resumo__texto">
                {executores
                  .map((e) =>
                    [e.nome, e.cnpj ? `CNPJ ${cnpj(e.cnpj)}` : null].filter(Boolean).join(', '),
                  )
                  .join('; ')}
              </dd>
            </>
          )}
        </dl>
        <p>
          A fonte escreve a situação como “{obra.situacaoNaFonte}”. A medição é a execução física
          informada ao Obrasgov.br, não o dinheiro pago.
        </p>
      </Secao>

      <Secao id="paradas" titulo="Paradas, se houve" periodo={ateAColeta} fonte={fonte}>
        {interrupcoes.length === 0 ? (
          <p>
            Nenhuma paralisação, cancelamento ou declaração de obra inacabada registrada na fonte.
          </p>
        ) : (
          <>
            <p>
              {`${NUMERO.format(interrupcoes.length)} ${interrupcoes.length === 1 ? 'interrupção registrada' : 'interrupções registradas'}, da mais recente para a mais antiga.`}
            </p>
            <ul className="linhas">
              {interrupcoes.map((i) => (
                <li key={`${i.em}|${i.tipo}|${i.justificativa ?? ''}`} className="linha">
                  <p className="linha__chave">{INTERRUPCOES[i.tipo] ?? i.tipo}</p>
                  <div className="linha__corpo">
                    <p>{dia(i.em)}</p>
                    <p className="nota">{i.justificativa ?? 'Sem justificativa na fonte.'}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>

      <Secao
        id="reservado"
        titulo="Dinheiro de emenda reservado para a obra"
        periodo={periodoDasEmendas(obra.fonte.coletadaEm)}
        fonte={fonte}
      >
        {emendas.length === 0 ? (
          <p>Nenhum empenho de emenda parlamentar ligado a esta obra.</p>
        ) : (
          <>
            <p>
              {`${NUMERO.format(emendas.length)} ${emendas.length === 1 ? 'empenho de emenda parlamentar' : 'empenhos de emendas parlamentares'}. O que a base registra é o valor reservado (empenhado) por cada emenda, e não o pagamento já feito à obra.`}
            </p>
            <ul className="linhas">
              {emendas.map((e) => (
                <li key={`${e.codigoDaEmenda}|${e.numeroDoEmpenho}`} className="linha">
                  <p className="linha__chave">{reaisResumidos(e.empenhadoCentavos)}</p>
                  <div className="linha__corpo">
                    <p>
                      {e.emendaId ? (
                        <Link href={`/emendas/${e.emendaId}`}>Emenda {e.codigoDaEmenda}</Link>
                      ) : (
                        `Emenda ${e.codigoDaEmenda}`
                      )}
                      {e.autor && (
                        <>
                          {' '}
                          de{' '}
                          {e.autor.pessoaId ? (
                            <Link href={`/parlamentares/${e.autor.pessoaId}`}>{e.autor.nome}</Link>
                          ) : (
                            e.autor.nome
                          )}
                        </>
                      )}
                    </p>
                    <p className="nota">
                      Empenho {e.numeroDoEmpenho}: {reais(e.empenhadoCentavos)}
                      {e.emitidoEm ? ` em ${dia(e.emitidoEm)}` : ''}
                      {e.acaoOrcamentaria ? ` · ação ${e.acaoOrcamentaria}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p>
              A ligação vem do próprio empenho, que traz o código da emenda no Portal da
              Transparência.
            </p>
          </>
        )}
      </Secao>
    </main>
  );
}
