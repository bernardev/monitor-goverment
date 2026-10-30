/**
 * URL de conexão de um contexto: `<SCHEMA>_DATABASE_URL` (ex.: `AGENTES_PUBLICOS_DATABASE_URL`), com o
 * usuário do próprio contexto (ADR-0006). Fora de produção, cai no ambiente local de infra/docker, na
 * porta `POSTGRES_PORTA` (padrão 5432).
 */
export function urlDoBanco(schema: string, ambiente: NodeJS.ProcessEnv = process.env): string {
  const variavel = `${schema.toUpperCase()}_DATABASE_URL`;
  const url = ambiente[variavel];
  if (url) return url;
  if (ambiente['NODE_ENV'] === 'production') {
    throw new Error(`Defina ${variavel}: em produção não há conexão padrão.`);
  }
  const porta = ambiente['POSTGRES_PORTA'] ?? '5432';
  return `postgres://ctx_${schema}:desenvolvimento@localhost:${porta}/prometeu`;
}
