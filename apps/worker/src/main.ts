import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module.js';

/**
 * Processo de fundo: relay da outbox, consumidores de eventos, projeções e alertas (ADR-0007, ADR-0008).
 * Usa os mesmos módulos da API, com outro ponto de entrada. Encerra com SIGTERM/SIGINT, esperando o
 * trabalho em curso.
 */
async function iniciar(): Promise<void> {
  const contexto = await NestFactory.createApplicationContext(WorkerModule);
  contexto.enableShutdownHooks();
}

void iniciar();
