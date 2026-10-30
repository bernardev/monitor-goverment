# ADR-0014: Identidade e acesso

- **Status:** Aceito
- **Data:** 2026-10-28 (proposto) · 2026-10-30 (aceito)

## Contexto

Há dois públicos com necessidades diferentes: **cidadãos** (conta opcional para acompanhar e receber alertas;
mínimo de dados pessoais) e **equipe editorial** (curadores, revisores, editores, com ações auditáveis e
exigência de segundo fator).

## Decisão

- Autenticação via **OIDC** com **Keycloak auto-hospedado**. O produto só conhece o padrão (emissor,
  chaves públicas, papéis no token); trocar de provedor é configuração, não código.
- **Papéis** (papéis do realm `prometeu`): `cidadao`, `curador`, `revisor`, `editor_chefe`,
  `administrador`. O domínio só vê o identificador da pessoa (`sub` do token, um UUID) como `CuradorId`.
- **Painel de curadoria:** cliente confidencial `curadoria`, fluxo de código de autorização com PKCE. A
  sessão fica num cookie cifrado e `httpOnly`; o token nunca chega ao JavaScript do navegador.
- **API:** valida a assinatura do token com as chaves públicas do Keycloak (JWKS), o emissor e a audiência
  `prometeu-api`. Cada rota editorial declara os papéis aceitos.
- **Quem faz o quê na v1:**
  - `curador`: registra promessas, adiciona fontes, captura documentos, propõe vereditos.
  - `revisor` e `editor_chefe`: publicam ou recusam vereditos. A regra dos quatro olhos continua no
    domínio: quem propôs um veredito sensível não pode publicá-lo, qualquer que seja o papel.
- **Equipe editorial: 2FA obrigatório**, exigido pelo Keycloak (ação obrigatória de configurar OTP em toda
  conta editorial de produção). Toda ação editorial grava o autor nos eventos (log de auditoria).
- Cidadão: login sem senha (link por e-mail) ou social; dados mínimos (e-mail, município, preferências).
  Base legal LGPD: consentimento para alertas; exclusão de conta self-service. Fica para a etapa de
  Engajamento.
- Leitura do site e da API pública não exige conta.

## Alternativas consideradas

- **Zitadel auto-hospedado:** mais leve, comunidade menor.
- **Serviço gerenciado (Auth0, Clerk):** zero operação, mas custo por usuário e dados de login fora do
  Brasil, o que complica a LGPD.

## Consequências

- **Positivas:** dados de login sob nosso controle; 2FA, papéis e auditoria de login prontos; padrão
  aberto.
- **Negativas / custos:** operar mais um serviço (banco próprio, atualização, backup).
- **O que precisa acontecer a partir de agora:** o realm de produção é criado com OTP obrigatório e sem os
  usuários de exemplo de `infra/docker/keycloak/` (que existem só para o ambiente local).
