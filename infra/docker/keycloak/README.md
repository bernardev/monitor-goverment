# Keycloak local

`realm-prometeu.json` é importado quando o contêiner sobe ([ADR-0014](../../../docs/adr/0014-identidade-e-acesso.md)).
Serve **só ao ambiente local**: os usuários de exemplo, a senha `desenvolvimento`, o segredo do cliente e o
cliente `ferramentas-locais` (login por senha na linha de comando) não existem em produção, onde toda conta
editorial tem OTP obrigatório.

| Usuário                 | Papéis                    |
| ----------------------- | ------------------------- |
| `curadora`              | `curador`                 |
| `revisor`               | `revisor`                 |
| `editora`               | `editor_chefe`, `curador` |
| `cidada@prometeu.local` | `cidadao`                 |

Console de administração: `http://localhost:8080/admin` (usuário `admin`, senha `desenvolvimento`).

Qualquer pessoa pode criar conta pela tela de login do site (cadastro aberto): toda conta nova recebe o
papel `cidadao`, e os papéis editoriais são dados à mão. Localmente o cadastro é por e-mail e senha, sem
confirmação de e-mail, porque não há servidor de e-mail; em produção entram a confirmação e o login por
link.

O realm só é importado quando ainda não existe. Num Keycloak que já subiu antes desta versão, aplique as
mudanças pelo console ou recrie o volume do contêiner.
