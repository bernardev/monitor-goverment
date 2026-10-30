import { defineConfig } from 'drizzle-kit';

// Gera as migrações do schema `financas_publicas` a partir de src/infrastructure/esquema.ts (ADR-0015).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/esquema.ts',
  out: './drizzle',
  schemaFilter: ['financas_publicas'],
});
