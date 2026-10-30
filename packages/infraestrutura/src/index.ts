// Adaptadores comuns (ADR-0015). Só camadas `infrastructure/` e apps importam este pacote.
export { BancoDoContexto, type Executor } from './banco.js';
export {
  BarramentoPgBoss,
  type BarramentoDeEventos,
  type ManipuladorDeEvento,
} from './barramento.js';
export { urlDoBanco } from './configuracao.js';
export { consumidorIdempotente } from './consumidor.js';
export { comCorrelacao, idDeCorrelacaoAtual } from './correlacao.js';
export { migrar } from './migracoes.js';
export { gravarNaOutbox, RelayDaOutbox } from './outbox.js';
export {
  definirInbox,
  definirOutbox,
  outboxDaIngestao,
  type TabelaInbox,
  type TabelaOutbox,
} from './tabelas.js';
