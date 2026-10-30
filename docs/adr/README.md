# Registros de Decisão de Arquitetura (ADR)

Cada decisão estrutural fica registrada com contexto, alternativas e consequências. Um ADR aceito não é
editado: se a decisão mudar, cria-se um novo ADR que **substitui** o anterior.

Status possíveis: `Proposto` · `Aceito` · `Substituído por ADR-XXXX` · `Descontinuado`.

| #                                                  | Decisão                                                           | Status   |
| -------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| [0001](0001-registrar-decisoes.md)                 | Registrar decisões arquiteturais em ADRs                          | Aceito   |
| [0002](0002-monolito-modular.md)                   | Monólito modular orientado a DDD, não microsserviços              | Aceito   |
| [0003](0003-arquitetura-hexagonal.md)              | Arquitetura hexagonal dentro de cada módulo                       | Aceito   |
| [0004](0004-stack-do-produto.md)                   | Stack do produto: TypeScript, NestJS, Next.js, monorepo           | Aceito   |
| [0005](0005-plataforma-de-dados-python.md)         | Plataforma de dados em Python com camadas bronze e prata          | Aceito   |
| [0006](0006-postgresql-schema-por-contexto.md)     | PostgreSQL com um schema por contexto                             | Aceito   |
| [0007](0007-eventos-e-outbox.md)                   | Integração entre contextos por eventos com outbox transacional    | Aceito   |
| [0008](0008-cqrs-projecoes-de-leitura.md)          | CQRS: projeções de leitura para site e API pública                | Aceito   |
| [0009](0009-proveniencia-obrigatoria.md)           | Proveniência obrigatória: toda informação aponta para uma captura | Aceito   |
| [0010](0010-ia-com-humano-no-circuito.md)          | IA como assistente, com humano no circuito                        | Aceito   |
| [0011](0011-linguagem-ubiqua-em-portugues.md)      | Linguagem ubíqua em português no código de domínio                | Aceito   |
| [0012](0012-modelo-federativo-generico.md)         | Modelo federativo genérico desde o primeiro dia                   | Aceito   |
| [0013](0013-hospedagem.md)                         | Hospedagem e implantação                                          | Proposto |
| [0014](0014-identidade-e-acesso.md)                | Identidade e acesso                                               | Proposto |
| [0015](0015-outbox-por-schema-e-barramento.md)     | Outbox por schema, relay por contexto e barramento pg-boss        | Aceito   |
| [0016](0016-registro-de-capturas-na-importacao.md) | Capturas registradas pelo Acervo durante a importação             | Aceito   |

Modelo para novos ADRs: copie [template.md](template.md).
