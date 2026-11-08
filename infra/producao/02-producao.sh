#!/bin/sh
# Roda só na criação do banco, depois de 01-schemas-por-contexto.sql: troca as senhas locais e cria o
# banco do Keycloak.
set -eu

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE DATABASE keycloak;
DO \$\$
DECLARE papel text;
BEGIN
  FOR papel IN SELECT rolname FROM pg_roles WHERE rolname LIKE 'ctx_%' LOOP
    EXECUTE format('ALTER ROLE %I PASSWORD %L', papel, '$SENHA_DOS_CONTEXTOS');
  END LOOP;
END
\$\$;
SQL
