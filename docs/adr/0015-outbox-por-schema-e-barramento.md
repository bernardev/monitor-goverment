# ADR-0015: Outbox por schema, relay por contexto e barramento pg-boss

- **Status:** Aceito
- **Data:** 2026-10-30

## Contexto

O [ADR-0007](0007-eventos-e-outbox.md) decidiu outbox transacional e pg-boss, e o
[ADR-0006](0006-postgresql-schema-por-contexto.md) deu a cada contexto um usuário de banco que só escreve no
próprio schema. Falta dizer onde a outbox mora, quem a lê e como consumidores garantem idempotência sem
furar esse isolamento.

## Decisão

- **Uma tabela `outbox` e uma `inbox` em cada schema**, com o mesmo formato. O repositório grava agregado e
  eventos na mesma transação, com o usuário do contexto. A plataforma de dados grava `LoteIngerido` em
  `ingestao.outbox`.
- **Um relay por contexto**, com o usuário do contexto: lê eventos não publicados (`FOR UPDATE SKIP LOCKED`),
  publica no barramento e marca como publicados. A entrega é **pelo menos uma vez**.
- **Barramento pg-boss** atrás da porta `BarramentoDeEventos`, no schema `barramento`, com usuário próprio.
  Publicação por tipo de evento (`publish`) e uma fila por consumidor (`subscribe`), para que cada
  consumidor tenha suas próprias tentativas e sua fila de falhas.
- **Consumidor idempotente:** o registro na `inbox` (id do evento + consumidor) e o efeito acontecem na mesma
  transação. Evento repetido é ignorado.
- **Transação ambiente:** a infraestrutura abre a transação e a guarda em `AsyncLocalStorage`; repositórios
  usam a transação corrente quando existe. Domínio e casos de uso não sabem disso.
- **Migrações por contexto** com Drizzle, cada uma registrada em `<schema>.__migracoes` e aplicada com o
  usuário do contexto. No schema `ingestao`, Alembic.
- O código comum (transação, outbox, inbox, relay, barramento, migrações) fica em
  `packages/infraestrutura`. Só as camadas `infrastructure/` dos módulos e os apps podem importá-lo.

## Alternativas consideradas

- **Uma outbox única para todos os contextos:** exigiria um usuário com escrita em schema alheio, o que
  quebra o isolamento do ADR-0006.
- **Relay central com superusuário:** menos processos, mas um único ponto com acesso a tudo.
- **Passar a transação explicitamente por todos os métodos:** visível, mas obriga as portas da aplicação a
  conhecer um detalhe de banco.

## Consequências

- **Positivas:** isolamento real entre contextos; nenhum evento perdido; trocar o pg-boss por NATS ou Kafka
  mexe só no adaptador do barramento.
- **Negativas / custos:** um relay por contexto no worker; consumidores precisam tolerar repetição e ordem
  trocada.
- **O que precisa acontecer a partir de agora:** todo repositório de agregado grava eventos na outbox; todo
  consumidor passa pela inbox; testes de integração cobrem os dois.
