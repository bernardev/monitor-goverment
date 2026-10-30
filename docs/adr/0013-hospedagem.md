# ADR-0013: Hospedagem e implantação

- **Status:** Proposto
- **Data:** 2026-10-28

## Contexto

A decisão de provedor depende de orçamento, financiamento e equipe, ainda não definidos. A arquitetura não
deve depender dessa escolha.

## Decisão (proposta)

- Tudo roda em **contêineres** (12-factor: configuração por variável de ambiente, processos sem estado).
- Ambiente local completo via **Docker Compose** (PostgreSQL com pgvector, RustFS como S3 local, Dagster, API, worker, web). O MinIO deixou de publicar imagens no Docker Hub.
- Infraestrutura de produção descrita como código (**Terraform** ou **OpenTofu**).
- Ambientes: `local` → `homologacao` → `producao`, com deploy automático a partir da `main` para homologação
  e promoção manual para produção.
- Candidatos a provedor, a decidir: AWS região São Paulo (ECS/RDS/S3), Google Cloud São Paulo, ou opção de
  menor custo inicial (VPS gerenciada + PostgreSQL gerenciado + R2). CDN na frente do site em qualquer cenário.

## Pendências para aceitar

- Orçamento mensal disponível.
- Requisitos de residência de dados (preferência por região no Brasil).
