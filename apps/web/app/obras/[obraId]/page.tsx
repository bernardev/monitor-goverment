import { Capitulo, Cifra, Proporcao } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarObra } from '../../_api/cliente';
import { Fonte } from '../../_componentes/fonte';
import {
  cnpj,
  dia,
  nomeDaSituacaoDaObra,
  percentual,
  reais,
  reaisResumidos,
} from '../../_componentes/formatacao';
import { lugarDaObra, situacaoEMedicao } from '../../_componentes/obras';
import { Topo } from '../../_componentes/topo';

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

  return (
    <main className="capitulos">
      <Topo
        titulo={obra.nome}
        voltar={{ href: '/obras', texto: 'Todas as obras' }}
        aoLado={
          medicao === null ? (
            <Cifra
              valor={nomeDaSituacaoDaObra(obra.situacao)}
              legenda="O Obrasgov ainda não registra execução física desta obra."
            />
          ) : (
            <Cifra
              valor={percentual(medicao.percentualCentesimos)}
              legenda={`executado${medicao.em ? ` na medição de ${dia(medicao.em)}` : ''}, segundo o Obrasgov.`}
            />
          )
        }
      >
        <p className="destaque">
          {[obra.natureza, obra.especie].filter((parte) => parte !== null).join(' · ')} em{' '}
          {obra.municipios.length === 0
            ? lugarDaObra(obra)
            : obra.municipios.map((m, n) => (
                <span key={m.codigoIbge}>
                  {n > 0 ? ', ' : ''}
                  <Link href={`/municipios/${m.codigoIbge}`}>{m.nome ?? m.codigoIbge}</Link>
                </span>
              ))}
          {obra.uf && obra.municipios.length > 0 ? ` - ${obra.uf}` : ''}.
        </p>
        {obra.descricao && !mesmoTexto(obra.descricao, obra.nome) && <p>{obra.descricao}</p>}
        <p className="nota">
          Projeto {obra.idNaFonte} no Obrasgov.br, o cadastro federal de obras e projetos de
          investimento.{obra.endereco ? ` Endereço: ${obra.endereco}.` : ''}
        </p>
        <Fonte fonte={obra.fonte} />
      </Topo>

      <Capitulo
        id="executou"
        campo="aco"
        verbo="Executou."
        frase={`${situacaoEMedicao(obra)}. Investimento previsto de ${reaisResumidos(obra.investimentoPrevistoCentavos)}.`}
        aoLado={
          medicao === null ? undefined : (
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
          )
        }
        nota={
          <p>
            A fonte escreve a situação como “{obra.situacaoNaFonte}”. A medição é a execução física
            informada ao Obrasgov, não o dinheiro pago.
          </p>
        }
      >
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
      </Capitulo>

      {interrupcoes.length > 0 && (
        <Capitulo
          id="parou"
          campo="papel"
          verbo="Parou."
          frase={`${String(interrupcoes.length)} ${interrupcoes.length === 1 ? 'interrupção registrada' : 'interrupções registradas'}, da mais recente para a mais antiga.`}
        >
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
        </Capitulo>
      )}

      <Capitulo
        id="foi-paga"
        campo="areia"
        verbo="Foi paga."
        frase={`Por ${String(emendas.length)} ${emendas.length === 1 ? 'empenho de emenda parlamentar' : 'empenhos de emendas parlamentares'}.`}
        nota={
          <p>
            A ligação vem do próprio empenho, que traz o código da emenda no Portal da
            Transparência.
          </p>
        }
      >
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
      </Capitulo>
    </main>
  );
}
