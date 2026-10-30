# ADR-0002: Monólito modular orientado a DDD, não microsserviços

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

Queremos escalar (mais esferas, mais fontes, picos de acesso em dias de votação e notícias) sem criar um
emaranhado. Microsserviços desde o início trazem custo operacional alto (rede, deploys, observabilidade
distribuída, consistência eventual em tudo) para uma equipe pequena, e as fronteiras do domínio ainda vão
amadurecer.

## Decisão

O produto é um **monólito modular**: um único deploy da API (e um do worker), composto por módulos que
correspondem um a um aos contextos delimitados do [mapa de contextos](../dominio/mapa-de-contextos.md).

Regras de fronteira, verificadas automaticamente no CI:

1. Um módulo só importa de outro módulo pelo **ponto de entrada público** (`modules/<contexto>/src/index.ts`),
   que expõe casos de uso (fachada) e contratos, nunca entidades ou repositórios.
2. Cada módulo é dono do seu schema no banco ([ADR-0006](0006-postgresql-schema-por-contexto.md)).
3. Efeitos entre módulos acontecem por eventos ([ADR-0007](0007-eventos-e-outbox.md)), não por chamadas síncronas
   que alteram estado alheio.

A plataforma de dados (ingestão) já nasce como processo separado, porque tem perfil de carga e linguagem
diferentes ([ADR-0005](0005-plataforma-de-dados-python.md)).

## Alternativas consideradas

- **Microsserviços por contexto:** fronteiras corretas, mas custo operacional desproporcional agora.
- **Monólito em camadas sem módulos:** rápido no início, vira "big ball of mud" quando o domínio cresce.

## Consequências

- **Positivas:** simplicidade operacional; refatorar fronteiras é barato; transações locais onde fazem sentido.
- **Caminho de escala:** como os módulos já se comunicam por eventos e têm schema próprio, extrair um módulo
  para serviço independente é trocar o adaptador do barramento e o deploy, sem reescrever o domínio.
- **Negativas:** exige disciplina; por isso as regras de fronteira são verificadas por ferramenta
  (dependency-cruiser), não por boa vontade.
