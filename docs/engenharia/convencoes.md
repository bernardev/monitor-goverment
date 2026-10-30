# Convenções de engenharia

> O que separa um produto profissional de um protótipo não é a tecnologia, é a disciplina repetível.
> Estas regras valem para todo código e são, sempre que possível, **verificadas por ferramenta**.

## Fluxo de trabalho (Git)

- **Trunk-based development:** a `main` está sempre implantável. Branches curtas (horas ou poucos dias),
  integradas por Pull Request.
- Nomes de branch: `tipo/descricao-curta` (ex.: `feat/presenca-com-motivo`, `fix/conector-senado-datas`).
- **Conventional Commits** em português:
  `feat(compromissos): registrar promessa a partir de transcrição`
  Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `build`.
  Escopo = nome do módulo, app ou conector.
- PR pequeno e focado, com descrição do **porquê**, link para issue/ADR e evidência de teste.
- `main` protegida: CI verde e revisão obrigatórios; sem push direto.
- Mudanças em `docs/adr/`, `packages/contracts/` e `modules/compromissos/src/domain/` exigem revisão do
  responsável (CODEOWNERS).

## Regras de arquitetura verificadas no CI

| Regra                                                                                                  | Ferramenta                         |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Módulo só importa outro módulo pelo `index.ts` público                                                 | dependency-cruiser                 |
| `domain/` não importa `application/`, `infrastructure/`, `interface/` nem bibliotecas de framework/ORM | dependency-cruiser                 |
| `apps/web` e `apps/curadoria` não importam módulos diretamente (só o cliente da API)                   | dependency-cruiser                 |
| Python: conectores não importam uns aos outros; pipelines só usam a interface do conector              | import-linter                      |
| Contratos de eventos e da camada prata: mudança incompatível exige nova versão                         | teste de compatibilidade de schema |

## Código

- TypeScript `strict`, sem `any` (exceções justificadas com comentário). Python com mypy `strict`.
- Lint e formatação automáticos: ESLint + Prettier; Ruff no Python. Rodam no pre-commit e no CI.
- Domínio:
  - Agregados expõem **métodos com intenção** (`promessa.publicarVeredito(...)`), nunca setters.
  - Objetos de valor imutáveis e validados na criação (`CodigoIbge.criar('3550308')`).
  - Regra de negócio violada retorna `Result.fail(DomainError)`; não lança exceção.
  - Identificadores: UUIDv7.
  - Dinheiro: sempre `Dinheiro` (centavos inteiros). Nunca `number` para valor monetário.
- Comentários explicam **por quê**, não o quê. Regras de negócio citam a fonte (lei, resolução, ADR).
- Sem código morto, sem `console.log` esquecido, sem TODO sem issue.

## Testes

| Nível               | O que cobre                                                    | Ferramenta            | Meta                            |
| ------------------- | -------------------------------------------------------------- | --------------------- | ------------------------------- |
| Unitário de domínio | Agregados, objetos de valor, invariantes, máquina de estados   | Vitest / pytest       | ≥ 90% de cobertura em `domain/` |
| Caso de uso         | Orquestração com portas falsas (in-memory)                     | Vitest                | Todo caso de uso                |
| Integração          | Repositórios, outbox, consumidores contra Postgres real        | Testcontainers        | Todo adaptador                  |
| Contrato de fonte   | Conector contra respostas gravadas da fonte real               | pytest + fixtures     | Todo conector                   |
| Contrato de eventos | Produtor e consumidor concordam com o schema                   | JSON Schema           | Todo evento                     |
| Avaliação de IA     | Prompts contra casos anotados (precisão de extração e vínculo) | Conjunto de avaliação | Quando prompt muda              |
| Ponta a ponta       | Jornadas críticas (ver perfil, acompanhar, curar e publicar)   | Playwright            | Poucos e estáveis               |

Testes de domínio usam **construtores de teste** (`umaPromessa().comFonte(...).build()`) para ficarem
legíveis como especificação.

## Definição de pronto (DoD)

Uma tarefa só está pronta quando:

- [ ] O código segue a linguagem ubíqua (termo novo foi adicionado ao glossário).
- [ ] Testes do nível adequado foram escritos e passam.
- [ ] CI verde (lint, tipos, testes, regras de arquitetura, varredura de segurança).
- [ ] Toda informação exibida tem fonte e captura (ADR-0009).
- [ ] Logs e métricas relevantes existem (com `idDeCorrelacao`).
- [ ] Decisão estrutural nova tem ADR.
- [ ] Documentação de API/evento atualizada quando o contrato mudou.
- [ ] Revisado e aprovado em PR.

## Pipeline de CI

```
instalar → lint → checagem de tipos → regras de arquitetura → testes unitários
        → testes de integração (Testcontainers) → build → varredura (dependências, segredos)
        → [main] deploy em homologação
```

Turborepo executa só o que foi afetado pela mudança; o cache remoto acelera o CI.

## Versionamento e contratos

- API pública versionada na URL (`/v1`). Mudança incompatível = nova versão, com período de convivência.
- Eventos e tabelas prata: versão semântica no contrato; consumidores declaram a versão que aceitam.
- Migrações de banco sempre compatíveis com a versão anterior do código (expandir → migrar → contrair).
