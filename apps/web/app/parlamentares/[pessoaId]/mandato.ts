import { data } from '../../_componentes/formatacao';

/**
 * Os importadores sempre preenchem o fim do mandato (o da legislatura), então "em exercício" é
 * não ter fim ou o fim ainda não ter chegado.
 */
export function emExercicio(fim: string | null, agora: Date = new Date()): boolean {
  return fim === null || new Date(fim) > agora;
}

export function textoDoMandato(inicio: string, fim: string | null): string {
  return fim ? `mandato de ${data(inicio)} a ${data(fim)}` : `mandato desde ${data(inicio)}`;
}
