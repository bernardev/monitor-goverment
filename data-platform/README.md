# Plataforma de dados

Coleta das fontes oficiais, camadas bronze e prata. Decisões em
[ADR-0005](../docs/adr/0005-plataforma-de-dados-python.md).

```
src/prometeu_dados/
├── bronze.py          # Resposta bruta, hash e caminho no armazenamento de objetos
├── conectores/        # Um subpacote por fonte, todos seguindo conectores/base.py
└── definicoes.py      # Ativos e agendas do Dagster
```

## Comandos

```bash
uv sync
uv run pytest
uv run ruff check .
uv run mypy src tests
uv run lint-imports
uv run dagster dev -m prometeu_dados.definicoes
```
