import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { situacaoDasFontes } from '../_api/cliente';
import { dataEHora } from '../_componentes/formatacao';

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
    <main>
      <p>
        <Link href="/">← Início</Link>
      </p>
      <h1>Situação das fontes</h1>
      <p>
        Tudo o que o Prometeu publica vem de fontes oficiais, coletadas numa agenda. Quando uma
        coleta atrasa, o dado da fonte pode estar mais velho do que parece: esta página diz quando
        foi a última de cada uma.
      </p>
      <ul className="lista">
        {fontes.map((f) => (
          <li key={f.fonte}>
            <strong>{f.nome}</strong> · {SITUACOES[f.situacao]}
            <span>
              Coletada {PERIODICIDADES[f.periodicidade]}
              {f.ultimaColetaEm ? `; última coleta em ${dataEHora(f.ultimaColetaEm)}` : ''}.
            </span>
            {f.tabelas.length > 0 && (
              <span>
                {f.tabelas
                  .map((t) => `${t.tabela}: ${t.registros.toLocaleString('pt-BR')} registros`)
                  .join(' · ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
