import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { situacaoDasFontes } from '../_api/cliente';
import { dataEHora, plural } from '../_componentes/formatacao';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';

export const metadata: Metadata = {
  title: 'Situação das fontes | Prometeu',
  description:
    'Quando cada fonte oficial foi coletada pela última vez e se as coletas estão em dia.',
};

// A situação muda a cada coleta: a página é montada a cada visita, não no build.
export const dynamic = 'force-dynamic';

const SITUACOES = {
  em_dia: 'Em dia',
  atrasada: 'Atrasada',
  nunca_coletada: 'Ainda não coletada',
} as const;

const PERIODICIDADES = { diaria: 'todo dia', semanal: 'toda semana' } as const;

export default async function PaginaDasFontes(): Promise<ReactNode> {
  const fontes = await situacaoDasFontes();

  return (
    <PaginaDeLista
      chapeu="Transparência"
      titulo="Situação das fontes"
      descricao="Tudo o que o Prometeu publica vem de fontes oficiais, coletadas numa agenda. Quando uma coleta atrasa, o dado pode estar mais velho do que parece: aqui está a última coleta de cada fonte."
      contagem={plural(fontes.length, 'fonte oficial', 'fontes oficiais')}
      fonte={<p className="fonte">Fonte: registro das coletas feitas pelo próprio Prometeu.</p>}
    >
      <ul className="lista lista--fios">
        {fontes.map((f) => (
          <li key={f.fonte}>
            <strong>{f.nome}</strong>
            <span>
              <b>{SITUACOES[f.situacao]}</b>. Coletada {PERIODICIDADES[f.periodicidade]}
              {f.ultimaColetaEm ? `; última coleta em ${dataEHora(f.ultimaColetaEm)}` : ''}.
            </span>
            {f.tabelas.length > 0 && (
              <span>
                {f.tabelas
                  .map((t) => `${t.tabela}: ${plural(t.registros, 'registro', 'registros')}`)
                  .join(' · ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </PaginaDeLista>
  );
}
