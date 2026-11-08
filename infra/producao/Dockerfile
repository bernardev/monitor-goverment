# Uma imagem para a API, o worker, o site e o painel; o comando no compose escolhe o papel.
FROM node:24-slim

RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

ENV NODE_ENV=production
