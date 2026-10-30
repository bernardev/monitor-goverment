export interface FalhaDeImportacao {
  readonly codigoNaFonte: string;
  readonly erro: string;
  readonly mensagem: string;
}

/** O que um lote da prata produziu. Uma linha recusada não impede as outras; ela volta aqui. */
export interface ResumoDaImportacao {
  readonly loteId: string;
  readonly importacao: 'frequencia_da_camara' | 'votacoes_da_camara' | 'votacoes_do_senado';
  readonly lidos: number;
  readonly novos: number;
  readonly falhas: readonly FalhaDeImportacao[];
}
