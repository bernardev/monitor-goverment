'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { dataPorExtenso } from './capa';

/**
 * A data da capa. A página é regerada a cada 5 minutos, então o texto do servidor pode ser de ontem
 * para quem chega de manhã; depois de montar, o navegador põe o dia de hoje (Brasília).
 */
export function DataDoDia({ inicial }: { inicial: string }): ReactNode {
  const [texto, setTexto] = useState(inicial);
  useEffect(() => {
    setTexto(dataPorExtenso(new Date()));
  }, []);
  return <span>{texto}</span>;
}
