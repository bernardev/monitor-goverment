#!/bin/sh
# Gera, uma vez, os segredos em infra/producao/.env e o realm de produção em infra/producao/realm.
# Uso: infra/producao/preparar.sh <ip-da-vps>
set -eu
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  base="$(echo "$1" | tr . -).sslip.io"
  umask 077
  {
    echo "DOMINIO_SITE=prometeu.$base"
    echo "DOMINIO_PAINEL=painel.$base"
    echo "DOMINIO_LOGIN=login.$base"
    for nome in POSTGRES_PASSWORD SENHA_DOS_CONTEXTOS SENHA_DOS_OBJETOS SENHA_DO_ADMIN_DA_IDENTIDADE \
      SEGREDO_DO_CLIENTE_SITE SEGREDO_DO_CLIENTE_PAINEL SEGREDO_DA_SESSAO_SITE SEGREDO_DA_SESSAO_PAINEL \
      SENHA_CURADORA SENHA_REVISOR SENHA_EDITORA; do
      echo "$nome=$(openssl rand -hex 24)"
    done
  } > .env
fi

set -a
. ./.env
set +a
mkdir -p realm
python3 gerar_realm.py ../docker/keycloak/realm-prometeu.json realm/realm-prometeu.json
chmod 755 realm
chmod 644 realm/realm-prometeu.json
