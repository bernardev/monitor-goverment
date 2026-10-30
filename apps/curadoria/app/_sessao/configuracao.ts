import 'server-only';

/** Configuração do painel; fora de produção, o ambiente local de infra/docker (ADR-0014). */
function ler(nome: string, padraoLocal: string): string {
  const valor = process.env[nome];
  if (valor) return valor;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(`Defina ${nome}: em produção não há valor padrão.`);
  }
  return padraoLocal;
}

export const configuracao = {
  get enderecoDoPainel(): string {
    return ler('CURADORIA_URL', 'http://localhost:3002');
  },
  get emissor(): string {
    return ler('IDENTIDADE_EMISSOR', 'http://localhost:8080/realms/prometeu');
  },
  get clienteId(): string {
    return ler('CURADORIA_CLIENTE_ID', 'curadoria');
  },
  get clienteSegredo(): string {
    return ler('CURADORIA_CLIENTE_SEGREDO', 'desenvolvimento');
  },
  /** Ao menos 32 caracteres; cifra o cookie da sessão. */
  get segredoDaSessao(): string {
    return ler('CURADORIA_SEGREDO_DA_SESSAO', 'desenvolvimento-local-nao-use-em-producao');
  },
  get api(): string {
    return ler('API_URL', 'http://localhost:3000');
  },
};
