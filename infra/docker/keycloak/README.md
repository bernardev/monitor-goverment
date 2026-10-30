# Keycloak local

`realm-prometeu.json` é importado quando o contêiner sobe ([ADR-0014](../../../docs/adr/0014-identidade-e-acesso.md)).
Serve **só ao ambiente local**: os usuários de exemplo, a senha `desenvolvimento`, o segredo do cliente e o
cliente `ferramentas-locais` (login por senha na linha de comando) não existem em produção, onde toda conta
editorial tem OTP obrigatório.

| Usuário    | Papéis                    |
| ---------- | ------------------------- |
| `curadora` | `curador`                 |
| `revisor`  | `revisor`                 |
| `editora`  | `editor_chefe`, `curador` |

Console de administração: `http://localhost:8080/admin` (usuário `admin`, senha `desenvolvimento`).
