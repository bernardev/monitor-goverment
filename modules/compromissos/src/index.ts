// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.

export type { ConsultaDeMandatos, Relogio } from './application/portas.js';
export type { FonteInput } from './application/entrada.js';

export {
  AdicionarFonte,
  type AdicionarFonteInput,
  type AdicionarFonteOutput,
} from './application/casos-de-uso/adicionar-fonte.js';
export {
  PublicarVeredito,
  type PublicarVereditoInput,
  type PublicarVereditoOutput,
  RecusarVeredito,
  type RecusarVereditoInput,
} from './application/casos-de-uso/decidir-veredito.js';
export {
  ConfirmarVinculo,
  type ConfirmarVinculoInput,
  RejeitarVinculo,
  type RejeitarVinculoInput,
} from './application/casos-de-uso/decidir-vinculo.js';
export {
  type FundamentoInput,
  ProporVeredito,
  type ProporVereditoInput,
} from './application/casos-de-uso/propor-veredito.js';
export {
  RegistrarPromessa,
  type RegistrarPromessaInput,
  type RegistrarPromessaOutput,
} from './application/casos-de-uso/registrar-promessa.js';
export {
  SugerirVinculo,
  type SugerirVinculoInput,
  type SugerirVinculoOutput,
} from './application/casos-de-uso/sugerir-vinculo.js';

// Contrato dos eventos publicados para os outros contextos (via outbox).
export type * from './domain/eventos.js';
