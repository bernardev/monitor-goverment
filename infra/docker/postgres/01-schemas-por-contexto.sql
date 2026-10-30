-- Um schema por contexto, cada um com um usuário que só escreve nele (ADR-0006). O schema `barramento`
-- é do pg-boss, a fila de eventos entre contextos (ADR-0015).
-- Senhas fixas valem apenas para o ambiente local.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
DECLARE
  contexto text;
BEGIN
  FOREACH contexto IN ARRAY ARRAY[
    'agentes_publicos', 'compromissos', 'atividade_legislativa', 'financas_publicas', 'obras',
    'acervo', 'editorial', 'engajamento', 'consulta', 'ingestao', 'barramento'
  ]
  LOOP
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', 'ctx_' || contexto, 'desenvolvimento');
    EXECUTE format('CREATE SCHEMA %I AUTHORIZATION %I', contexto, 'ctx_' || contexto);
  END LOOP;
END
$$;

-- A camada prata (schema ingestao) é lida pelos importadores dos contextos donos de cada fonte.
DO $$
DECLARE
  leitor text;
BEGIN
  FOREACH leitor IN ARRAY ARRAY[
    'ctx_agentes_publicos', 'ctx_atividade_legislativa', 'ctx_financas_publicas', 'ctx_obras',
    'ctx_acervo'
  ]
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA ingestao TO %I', leitor);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE ctx_ingestao IN SCHEMA ingestao GRANT SELECT ON TABLES TO %I',
      leitor
    );
  END LOOP;
END
$$;
