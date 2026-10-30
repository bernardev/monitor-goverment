import { Controller, Get } from '@nestjs/common';

export interface EstadoDeSaude {
  readonly status: 'ok';
  readonly servico: 'api';
}

/** Verificação de vida para o orquestrador de contêineres e o balanceador. */
@Controller('saude')
export class SaudeController {
  @Get()
  verificar(): EstadoDeSaude {
    return { status: 'ok', servico: 'api' };
  }
}
