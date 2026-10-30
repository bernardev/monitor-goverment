import { defineConfig } from 'vitest/config';

// Testes de integração sobem um PostgreSQL em contêiner; o primeiro pode baixar a imagem.
export default defineConfig({
  test: { testTimeout: 60_000, hookTimeout: 180_000 },
});
