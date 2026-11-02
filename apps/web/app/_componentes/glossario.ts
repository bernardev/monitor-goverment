/** As explicações para leigos, com os textos-base da especificação do visual de jornal. */
export const GLOSSARIO: Readonly<
  Record<
    | 'emenda'
    | 'empenhado'
    | 'pago'
    | 'sessao'
    | 'faltaJustificada'
    | 'votacaoNominal'
    | 'favorecido'
    | 'situacaoDaObra',
    string
  >
> = {
  emenda: 'dinheiro do orçamento federal que deputados e senadores indicam para estados e cidades.',
  empenhado: 'dinheiro reservado no orçamento para aquela despesa.',
  pago: 'dinheiro que já saiu para quem recebe.',
  sessao: 'reunião do plenário em que há registro de presença.',
  faltaJustificada: 'ausência com motivo aceito pela Casa (licença médica, missão oficial etc.).',
  votacaoNominal: 'votação em que fica registrado o voto de cada parlamentar.',
  favorecido: 'empresa ou órgão que recebeu o dinheiro.',
  situacaoDaObra: 'a que o Obrasgov.br informa (planejada, em execução, paralisada, concluída).',
};
