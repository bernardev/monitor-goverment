import { defineConfig } from 'drizzle-kit';

// Gera as migrações do schema `atividade_legislativa` a partir de src/infrastructure/esquema.ts (ADR-0015).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/esquema.ts',
  out: './drizzle',
  schemaFilter: ['atividade_legislativa'],
});
