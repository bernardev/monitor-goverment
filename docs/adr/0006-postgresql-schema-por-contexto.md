# ADR-0006: PostgreSQL com um schema por contexto

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

Precisamos de transações confiáveis, consultas analíticas razoáveis, busca textual em português e busca
semântica (ligar promessa a proposição e a ação orçamentária), sem multiplicar bancos cedo demais.

## Decisão

- **PostgreSQL** é o banco principal, com as extensões `pgvector` (similaridade semântica), `unaccent` e
  configuração de busca textual em português.
- **Um schema por contexto** (`agentes_publicos`, `compromissos`, `atividade_legislativa`,
  `financas_publicas`, `obras`, `acervo`, `editorial`, `engajamento`, `consulta`, `ingestao`).
- Cada módulo usa um **usuário de banco próprio** com permissão de escrita apenas no seu schema. O isolamento
  é garantido pelo banco, não só pela convenção.
- Nenhuma chave estrangeira entre schemas. Referências entre contextos são identificadores (UUIDv7).
- Cada módulo tem suas próprias migrações (Drizzle; Alembic no `ingestao`).
- Tabelas de alto volume (votos, despesas, pagamentos) são **particionadas por ano**.
- Datas: `timestamptz` em UTC; exibição em `America/Sao_Paulo`. Fatos guardam duas datas: **quando
  aconteceu** e **quando soubemos** (bitemporal leve), para responder "o que a fonte dizia em tal data".
- Arquivos (capturas, PDFs, vídeos, fotos) vão para **armazenamento de objetos S3-compatível**; o banco
  guarda só metadados e hash.

## Alternativas consideradas

- **Um banco por contexto:** isolamento máximo, custo operacional alto agora. Schemas com usuários
  separados dão o mesmo isolamento lógico e permitem separar fisicamente depois.
- **Banco de busca dedicado (OpenSearch/Meilisearch) desde o início:** fica atrás de uma porta `Busca`;
  adotado quando o Postgres não der conta.

## Consequências

- **Positivas:** uma tecnologia para operar; isolamento real; caminho claro para separar.
- **Negativas:** consultas que cruzam contextos só existem no lado de leitura ([ADR-0008](0008-cqrs-projecoes-de-leitura.md)).
