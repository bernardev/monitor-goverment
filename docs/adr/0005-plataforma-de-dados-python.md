# ADR-0005: Plataforma de dados em Python com camadas bronze e prata

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

O produto depende de dezenas de fontes oficiais heterogêneas: APIs (Câmara, Senado, Portal da Transparência),
arquivos em massa (CSV de gigabytes do TSE e da CGU), PDFs (planos de governo), páginas HTML (justificativas
de ausência) e vídeos (debates). Essas fontes mudam sem aviso; o Serenata de Amor parou justamente por isso.
O ecossistema Python (Polars, DuckDB, PDF, transcrição) é o mais forte para esse trabalho.

## Decisão

A ingestão é uma **plataforma de dados separada**, em `data-platform/`, escrita em **Python**, orquestrada por
**Dagster** (modelo de ativos com linhagem, que casa com a nossa exigência de proveniência).

Camadas:

1. **Bronze:** resposta bruta de cada fonte, imutável, em armazenamento de objetos (S3-compatível), com
   URL, data da coleta, hash SHA-256 e cabeçalhos. Nunca é alterada.
2. **Prata:** dados limpos, tipados, deduplicados e normalizados, em tabelas do schema `ingestao` no
   PostgreSQL. Cada tabela prata é um **contrato versionado** documentado em `packages/contracts/prata/`.
3. **Domínio:** os módulos do produto importam da prata por meio de **importadores** (camada anticorrupção),
   que traduzem para o modelo de cada contexto e emitem eventos de domínio.

Ao terminar um lote, a plataforma publica o evento de integração `LoteIngerido {fonte, tabela, intervalo,
versaoDoContrato}`. O módulo dono reage e importa.

Cada fonte é um **conector** que implementa a mesma interface (`coletar`, `validar`, `normalizar`) e tem:

- testes com respostas gravadas (fixtures) da fonte real;
- **verificação de contrato diária**: se a fonte mudou de formato, o pipeline falha de forma barulhenta e
  avisa, em vez de gravar dado errado;
- **SLA de atualização** exibido publicamente ("dados da Câmara atualizados há 3 horas").

Ferramentas: `uv` (dependências), Ruff, mypy `strict`, pytest, import-linter para fronteiras.

## Alternativas consideradas

- **Ingestão em TypeScript dentro do monólito:** uma linguagem só, mas fraca para CSV massivo, PDF e áudio,
  e misturaria cargas em lote com a API.
- **Airflow:** maduro, mas orientado a tarefas, não a ativos de dados; mais pesado de operar.
- **Fontes gravando direto nas tabelas do domínio:** rápido e frágil; quebra a anticorrupção.

## Consequências

- **Positivas:** fonte quebrada não derruba o produto; reprocessar tudo a partir do bronze é possível;
  linhagem completa do dado até a fonte.
- **Negativas:** duas linguagens no repositório; exige disciplina com os contratos da camada prata.
