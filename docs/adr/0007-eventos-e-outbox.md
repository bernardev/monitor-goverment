# ADR-0007: Integração entre contextos por eventos com outbox transacional

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

Quando uma obra é paralisada, várias coisas devem acontecer: o estágio da promessa ligada é reavaliado, a
página do político é atualizada e quem acompanha recebe alerta. Se o módulo de Obras chamar cada um
diretamente, ele passa a conhecer todos e qualquer falha no meio deixa o sistema inconsistente.

## Decisão

- Agregados registram **eventos de domínio**. O repositório grava o agregado e os eventos na tabela
  `outbox` **na mesma transação**.
- Um **relay** lê a outbox e publica no barramento. Consumidores são **idempotentes** (tabela `inbox` com o
  id do evento) e toleram entrega repetida e fora de ordem.
- O barramento fica atrás da porta `BarramentoDeEventos`. Adaptador inicial: **pg-boss** (fila sobre o
  próprio PostgreSQL, sem infraestrutura extra). Quando o volume pedir, troca-se para NATS JetStream ou
  Kafka sem mexer no domínio.
- Eventos de integração têm **esquema versionado** (JSON Schema em `packages/contracts/eventos/`), nome no
  passado em português e envelope padrão: `id`, `tipo`, `versao`, `ocorridoEm`, `idDeCorrelacao`, `dados`.
- A plataforma de dados publica `LoteIngerido` escrevendo na mesma outbox, o que dispensa um broker
  compartilhado entre Python e TypeScript.

## Alternativas consideradas

- **Chamadas síncronas entre módulos:** acoplamento temporal e falhas parciais.
- **Event Sourcing completo:** auditoria perfeita, mas complexidade alta. O histórico append-only do agregado
  `Promessa` dá a auditoria que precisamos onde ela importa.
- **Kafka desde o início:** desproporcional ao volume atual.

## Consequências

- **Positivas:** módulos desacoplados; nenhum evento perdido; caminho natural para extrair serviços.
- **Negativas:** consistência eventual entre contextos (segundos); exige rastreamento por `idDeCorrelacao`.
