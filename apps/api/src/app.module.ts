import { Module } from '@nestjs/common';

import { AutenticacaoModule } from './autenticacao/autenticacao.module.js';
import { EditorialModule } from './editorial/editorial.module.js';
import { EngajamentoModule } from './engajamento/engajamento.module.js';
import { ParlamentaresModule } from './parlamentares/parlamentares.module.js';
import { SaudeController } from './saude/saude.controller.js';

/**
 * Raiz de composição do monólito modular (ADR-0002): cada contexto delimitado entra aqui como um
 * módulo Nest exportado pelo `index.ts` do pacote em `modules/`.
 */
@Module({
  imports: [AutenticacaoModule, ParlamentaresModule, EditorialModule, EngajamentoModule],
  controllers: [SaudeController],
})
export class AppModule {}
