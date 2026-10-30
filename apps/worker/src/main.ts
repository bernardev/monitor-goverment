import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module.js';

/**
 * Processo de fundo: relay da outbox, consumidores de eventos, projeções e alertas (ADR-0007, ADR-0008).
 * Usa os mesmos módulos da API, com outro ponto de entrada.
 */
async function iniciar(): Promise<void> {
  const contexto = await NestFactory.createApplicationContext(WorkerModule);
  contexto.enableShutdownHooks();
  Logger.log('Worker iniciado; nenhum consumidor registrado ainda.', 'Inicializacao');
  await contexto.close();
}

void iniciar();
