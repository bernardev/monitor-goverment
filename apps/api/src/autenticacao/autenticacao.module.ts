import { Global, Module } from '@nestjs/common';

import { GuardaDeAutenticacao } from './guarda.js';
import { VerificadorDeToken } from './verificador-de-token.js';

/** Emissor e audiência do token (ADR-0014). Fora de produção, o Keycloak de infra/docker. */
function configuracao(ambiente: NodeJS.ProcessEnv = process.env) {
  const emissor = ambiente['IDENTIDADE_EMISSOR'];
  if (!emissor && ambiente['NODE_ENV'] === 'production') {
    throw new Error('Defina IDENTIDADE_EMISSOR: em produção não há emissor padrão.');
  }
  return {
    emissor: emissor ?? 'http://localhost:8080/realms/prometeu',
    audiencia: ambiente['IDENTIDADE_AUDIENCIA'] ?? 'prometeu-api',
  };
}

@Global()
@Module({
  providers: [
    { provide: VerificadorDeToken, useFactory: () => new VerificadorDeToken(configuracao()) },
    GuardaDeAutenticacao,
  ],
  exports: [VerificadorDeToken, GuardaDeAutenticacao],
})
export class AutenticacaoModule {}
