import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { situacaoDasFontes } from '../_api/cliente';
import { dataEHora } from '../_componentes/formatacao';
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
      titulo="Situação das fontes"
      descricao="Tudo o que o Prometeu publica vem de fontes oficiais, coletadas numa agenda. Quando uma coleta atrasa, o dado pode estar mais velho do que parece: aqui está a última coleta de cada fonte."
    >
      <ul className="linhas">
        {fontes.map((f) => (
          <li key={f.fonte} className="linha">
            <p className="linha__chave">{SITUACOES[f.situacao]}</p>
            <div className="linha__corpo">
              <p>
                <strong>{f.nome}</strong>, coletada {PERIODICIDADES[f.periodicidade]}
                {f.ultimaColetaEm ? `; última coleta em ${dataEHora(f.ultimaColetaEm)}` : ''}.
              </p>
              {f.tabelas.length > 0 && (
                <p className="nota">
                  {f.tabelas
                    .map((t) => `${t.tabela}: ${t.registros.toLocaleString('pt-BR')} registros`)
                    .join(' · ')}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PaginaDeLista>
  );
}
