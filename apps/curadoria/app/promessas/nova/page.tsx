import type { ReactNode } from 'react';

import { publica } from '../../_api/cliente';
import { FormularioDePromessa } from '../../_componentes/formularios';
import { UFS } from '../../_componentes/rotulos';
import { exigirSessao } from '../../_sessao/sessao';

interface Props {
  readonly searchParams: Promise<{ uf?: string }>;
}

export default async function NovaPromessa({ searchParams }: Props): Promise<ReactNode> {
  await exigirSessao();
  const busca = await searchParams;
  const uf = UFS.find((sigla) => sigla === busca.uf?.toUpperCase());
  const parlamentares = uf ? await publica.parlamentares(uf) : [];

  return (
    <main>
      <h1>Registrar promessa</h1>
      <form method="get" className="formulario em-linha">
        <label>
          Estado do parlamentar{' '}
          <select name="uf" defaultValue={uf ?? ''}>
            <option value="" disabled>
              Escolha
            </option>
            {UFS.map((sigla) => (
              <option key={sigla}>{sigla}</option>
            ))}
          </select>
        </label>{' '}
        <button type="submit">Carregar parlamentares</button>
      </form>
      {uf && parlamentares.length === 0 && <p>Nenhum parlamentar encontrado em {uf}.</p>}
      {parlamentares.length > 0 && <FormularioDePromessa parlamentares={parlamentares} />}
    </main>
  );
}
