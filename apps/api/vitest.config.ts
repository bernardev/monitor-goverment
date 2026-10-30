import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// O NestJS depende de metadados de decorators para injeção de dependência; o esbuild padrão do
// Vitest não os emite, por isso os testes são transpilados com SWC.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
