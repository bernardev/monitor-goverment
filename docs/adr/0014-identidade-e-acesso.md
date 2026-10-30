# ADR-0014: Identidade e acesso

- **Status:** Proposto
- **Data:** 2026-10-28

## Contexto

Há dois públicos com necessidades diferentes: **cidadãos** (conta opcional para acompanhar e receber alertas;
mínimo de dados pessoais) e **equipe editorial** (curadores, revisores, editores, com ações auditáveis e
exigência de segundo fator).

## Decisão (proposta)

- Autenticação via **OIDC** atrás da porta `ProvedorDeIdentidade`; provedor a decidir (ex.: Keycloak
  auto-hospedado ou serviço gerenciado). O domínio só conhece `UsuarioId` e papéis.
- Papéis: `cidadao`, `curador`, `revisor`, `editor_chefe`, `administrador`.
- Equipe editorial: **2FA obrigatório**; toda ação gravada em log de auditoria append-only.
- Cidadão: login sem senha (link por e-mail) ou social; dados mínimos (e-mail, município, preferências).
  Base legal LGPD: consentimento para alertas; exclusão de conta self-service.
- Leitura do site e da API pública não exige conta.

## Pendências para aceitar

- Escolha do provedor (custo × operação).
