import type { ReactNode } from 'react';

import { acompanhamentos, type TipoDeAlvo } from '../_api/conta';
import { sessaoDoCidadao } from '../_sessao/sessao';
import { alternarAcompanhamento } from '../conta/acoes';

/**
 * Acompanhar um político ou uma cidade. Sem login, o mesmo botão leva a entrar ou criar a conta e
 * traz a pessoa de volta a esta página.
 */
export async function Acompanhar({
  tipo,
  id,
  volta,
}: {
  tipo: TipoDeAlvo;
  id: string;
  volta: string;
}): Promise<ReactNode> {
  const sessao = await sessaoDoCidadao();
  const alvo = id.toLowerCase();
  const acompanhando =
    !!sessao && (await acompanhamentos(sessao)).some((a) => a.tipo === tipo && a.id === alvo);
  return (
    <form action={alternarAcompanhamento.bind(null, tipo, alvo, volta, acompanhando)}>
      <button type="submit" className={acompanhando ? 'botao botao--secundario' : 'botao'}>
        {acompanhando ? 'Acompanhando · deixar de acompanhar' : 'Acompanhar'}
      </button>
      {sessao === undefined && (
        <p className="nota acompanhar__nota">
          Com uma conta, você reúne em um lugar só os políticos e as cidades que quer acompanhar.
        </p>
      )}
    </form>
  );
}
