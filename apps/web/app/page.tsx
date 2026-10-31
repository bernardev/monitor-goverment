import { Cifra } from '@prometeu/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  listarEmendas,
  listarObras,
  listarParlamentares,
  listarProposicoes,
  listarVotacoes,
} from './_api/cliente';
import congresso from './_imagens/congresso.jpg';
import constituicao from './_imagens/constituicao-1988.jpg';
import senado from './_imagens/senado.jpg';

const NUMERO = new Intl.NumberFormat('pt-BR');

/** Só o total de cada lista; a página inicial abre mesmo se a API estiver fora. */
async function total(lista: Promise<{ total: number }>): Promise<number | undefined> {
  return lista.then((l) => l.total).catch(() => undefined);
}

function contagem(n: number | undefined, unidade: string): string {
  return n === undefined ? unidade : `${NUMERO.format(n)} ${unidade}`;
}

export default async function PaginaInicial(): Promise<ReactNode> {
  const [parlamentares, votacoes, proposicoes, emendas, obras, concluidas] = await Promise.all([
    total(listarParlamentares({ pagina: 1, itens: 1 })),
    total(listarVotacoes(1)),
    total(listarProposicoes({ pagina: 1 })),
    total(listarEmendas({ pagina: 1 })),
    total(listarObras({ pagina: 1, itens: 1 })),
    total(listarObras({ pagina: 1, itens: 1, situacao: 'concluida' })),
  ]);

  return (
    <main className="capitulos">
      <section className="abertura" data-campo="grafite" aria-labelledby="abertura">
        <h1 id="abertura" className="abertura__titulo">
          <span className="abertura__clara">Prometeu.</span> <span>Cumpriu?</span>
        </h1>
        <div className="abertura__pe surge">
          <form method="get" action="/busca" role="search" className="busca">
            <label htmlFor="q" className="oculto">
              Procure um parlamentar, um município ou uma obra
            </label>
            <input
              id="q"
              name="q"
              type="search"
              minLength={2}
              required
              placeholder="Um político, uma cidade, uma obra"
            />
            <button type="submit" className="botao">
              Buscar
            </button>
          </form>
          <p className="destaque">
            O que cada político prometeu e o que fez depois, do registro oficial à entrega, com a
            fonte de cada fato.
          </p>
        </div>
      </section>

      <section className="mosaico" data-campo="papel" aria-labelledby="mosaico">
        <div className="mosaico__quadro">
          <div className="mosaico__lema surge" data-campo="aco">
            <h2 id="mosaico" className="titulo">
              Fato,
              <br />
              com fonte.
            </h2>
          </div>
          <div className="mosaico__numero surge" data-campo="areia">
            <p className="titulo">{emendas === undefined ? 'Emendas' : NUMERO.format(emendas)}</p>
            <p>emendas ao orçamento acompanhadas desde 2023</p>
          </div>
          <div className="mosaico__foto surge">
            <Image
              src={congresso}
              alt="As torres do Congresso Nacional e a cúpula do Senado, em Brasília"
              sizes="(max-width: 820px) 50vw, 34vw"
              className="respira"
              priority
            />
          </div>
        </div>
        <div className="mosaico__texto surge">
          <p className="destaque">
            O Prometeu acompanha o que cada político prometeu e o que fez depois. Os fatos vêm das
            fontes oficiais: a Câmara e o Senado para presença, votos e proposições; o Portal da
            Transparência para as emendas ao orçamento; o Obrasgov para as obras que elas pagam.
            Cada número guarda a captura de onde saiu, com data e endereço, para qualquer pessoa
            conferir. A curadoria liga promessas a fatos, e nenhum veredito sai sem a revisão de uma
            segunda pessoa. A plataforma não tem partido: mostra o registro, não dá nota.
          </p>
          <p className="nota">
            Foto do Congresso: Agência Senado, CC BY 2.0, via Wikimedia Commons.
          </p>
        </div>
      </section>

      <figure className="faixa" data-campo="grafite">
        <Image
          src={constituicao}
          alt="O plenário do Congresso cheio, com papéis jogados para o alto, no dia da promulgação da Constituição"
          sizes="100vw"
          className="faixa__foto"
        />
        <figcaption className="faixa__legenda nota">
          O plenário do Congresso em 5 de outubro de 1988, dia em que a Constituição foi promulgada.
          Foto: Agência Senado, CC BY 2.0, via Wikimedia Commons.
        </figcaption>
      </figure>

      <section className="tela-numero" data-campo="areia" aria-labelledby="obras-concluidas">
        <h2 id="obras-concluidas" className="tela-numero__frase surge">
          Dinheiro de emenda que virou obra
        </h2>
        <Cifra
          valor={concluidas === undefined ? 'Obras' : NUMERO.format(concluidas)}
          legenda={`obras pagas com emendas parlamentares já concluídas, de ${contagem(obras, 'obras')} acompanhadas pelo Obrasgov.`}
        />
        <p className="nota">
          <Link href="/obras">Ver as obras, da maior para a menor</Link>
        </p>
      </section>

      <figure className="faixa" data-campo="aco">
        <Image
          src={senado}
          alt="As bancadas de madeira e as cadeiras azuis do plenário do Senado, vazias"
          sizes="100vw"
          className="faixa__foto respira"
        />
        <figcaption className="faixa__legenda nota">
          O plenário do Senado. Cada uma das 81 cadeiras e das 513 da Câmara tem um mandato
          acompanhado aqui. Foto: Boaventuravinicius, CC BY-SA 4.0, via Wikimedia Commons.
        </figcaption>
      </figure>

      <section className="entradas" data-campo="papel" aria-labelledby="entradas">
        <h2 id="entradas" className="titulo surge">
          Por onde começar
        </h2>
        <ul className="fichas surge">
          <Entrada href="/parlamentares" titulo="Parlamentares">
            {contagem(parlamentares, 'deputados e senadores em exercício')}, com presença, votos,
            proposições e emendas.
          </Entrada>
          <Entrada href="/votacoes" titulo="Votações nominais">
            {contagem(votacoes, 'votações')} nos últimos 90 dias, com o voto de cada parlamentar.
          </Entrada>
          <Entrada href="/proposicoes" titulo="Proposições">
            {contagem(proposicoes, 'propostas de lei')} da Câmara e do Senado, com a tramitação.
          </Entrada>
          <Entrada href="/emendas" titulo="Emendas">
            {contagem(emendas, 'emendas')}: quem indicou, para onde foi e quanto já foi pago.
          </Entrada>
          <Entrada href="/obras" titulo="Obras">
            {contagem(obras, 'obras')} pagas com emendas, com situação e medição.
          </Entrada>
          <Entrada href="/fontes" titulo="Fontes">
            A última coleta de cada fonte oficial e se a agenda está em dia.
          </Entrada>
        </ul>
      </section>
    </main>
  );
}

function Entrada({
  href,
  titulo,
  children,
}: {
  href: string;
  titulo: string;
  children: ReactNode;
}): ReactNode {
  return (
    <li className="ficha">
      <Link href={href} className="ficha__titulo">
        {titulo}
      </Link>
      <p className="ficha__texto">{children}</p>
    </li>
  );
}
