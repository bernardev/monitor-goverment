# Plataforma de dados

Coleta das fontes oficiais, camadas bronze e prata. Decisões em
[ADR-0005](../docs/adr/0005-plataforma-de-dados-python.md).

```
src/prometeu_dados/
├── bronze.py          # Resposta bruta, hash e porta do armazenamento de objetos
├── rede.py            # Porta HTTP usada pelos conectores
├── prata.py           # Registro prata com origem, lote e evento LoteIngerido
├── conectores/        # Um subpacote por fonte, todos seguindo conectores/base.py
├── ingestao.py        # Uma execução: coletar → bronze → validar → normalizar → prata
├── adaptadores/       # httpx, S3 e PostgreSQL
└── definicoes.py      # Ativos e agendas do Dagster (raiz de composição)
migracoes/             # Alembic do schema ingestao (prata e outbox)
```

Contratos das tabelas prata: [`packages/contracts/prata/`](../packages/contracts/prata/).

## Comandos

```bash
uv sync
uv run pytest                      # inclui integração com Postgres real (exige Docker)
uv run pytest -m "not integracao"  # só os testes rápidos
INGESTAO_DATABASE_URL=postgresql://ctx_ingestao:desenvolvimento@localhost:5432/prometeu uv run alembic upgrade head
uv run ruff check .
uv run mypy src tests
uv run lint-imports
uv run dagster dev -m prometeu_dados.definicoes
uv run dagster asset materialize -m prometeu_dados.definicoes --select camara_deputados
uv run dagster asset materialize -m prometeu_dados.definicoes --select camara_frequencia
uv run dagster asset materialize -m prometeu_dados.definicoes --select camara_votacoes
uv run dagster asset materialize -m prometeu_dados.definicoes --select senado_senadores,senado_votacoes
uv run dagster asset materialize -m prometeu_dados.definicoes --select camara_proposicoes,senado_proposicoes
uv run dagster asset materialize -m prometeu_dados.definicoes --select transparencia_emendas
uv run dagster asset materialize -m prometeu_dados.definicoes --select obrasgov_obras
```
