# Plataforma de dados (ADR-0005, ADR-0013): o daemon do Dagster, que dispara as agendas e o aviso de
# falha, e a interface web. Mesma imagem para os dois; o comando escolhe o papel.
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    DAGSTER_HOME=/opt/dagster

WORKDIR /app

# Dependências antes do código: mudar o código não reinstala tudo.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --group operacao

COPY src ./src
COPY migracoes ./migracoes
COPY alembic.ini README.md ./
RUN uv sync --frozen --group operacao

COPY dagster.yaml /opt/dagster/dagster.yaml

# Aplica as migrações da prata e sobe o daemon; a interface web usa outro comando no compose.
CMD ["sh", "-c", "alembic upgrade head && dagster-daemon run -m prometeu_dados.definicoes"]
