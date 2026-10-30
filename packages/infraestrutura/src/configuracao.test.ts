import { describe, expect, it } from 'vitest';

import { urlDoBanco } from './configuracao.js';

describe('urlDoBanco', () => {
  it('usa a variável do contexto', () => {
    expect(urlDoBanco('agentes_publicos', { AGENTES_PUBLICOS_DATABASE_URL: 'postgres://x' })).toBe(
      'postgres://x',
    );
  });

  it('fora de produção, cai no ambiente local com o usuário do contexto', () => {
    expect(urlDoBanco('consulta', {})).toBe(
      'postgres://ctx_consulta:desenvolvimento@localhost:5432/prometeu',
    );
  });

  it('respeita a porta do PostgreSQL local', () => {
    expect(urlDoBanco('consulta', { POSTGRES_PORTA: '5433' })).toContain('@localhost:5433/');
  });

  it('em produção, exige a variável', () => {
    expect(() => urlDoBanco('consulta', { NODE_ENV: 'production' })).toThrow(
      'CONSULTA_DATABASE_URL',
    );
  });
});
