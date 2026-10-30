import { Module } from '@nestjs/common';

import { Orquestrador } from './orquestrador.js';

/** Raiz de composição do worker: registra consumidores de eventos e jobs dos módulos. */
@Module({ providers: [Orquestrador] })
export class WorkerModule {}
