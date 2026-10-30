# ADR-0012: Modelo federativo genérico desde o primeiro dia

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

A v1 começa pelo nível federal, mas o objetivo é cobrir as três esferas (27 assembleias, 5.570 municípios).
Se o modelo nascer com "Câmara" e "Senado" fixos, cada nova esfera exigirá migração e reescrita.

## Decisão

- `EnteFederativo` (código IBGE, esfera, UF) e `CasaLegislativa` (ente + tipo) são genéricos. Câmara dos
  Deputados, Senado, ALESP e Câmara Municipal de Recife são **dados**, não tipos no código.
- `Cargo` é uma enumeração completa desde já (presidente até vereador).
- Fontes são **conectores plugáveis** ([ADR-0005](0005-plataforma-de-dados-python.md)). Adicionar uma assembleia é
  escrever um conector que produz as mesmas tabelas prata, sem mudar o domínio.
- A **cobertura** é um dado explícito: para cada casa e cada tipo de informação, registramos se temos dado,
  de que fonte e com que atualização. "Esta câmara não publica presença" é exibido como informação.

## Consequências

- **Positivas:** expandir para estados e municípios é trabalho de conectores e curadoria, não de arquitetura.
- **Negativas:** um pouco mais de abstração na v1 do que o estritamente federal exigiria.
