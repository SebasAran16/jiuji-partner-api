FROM node:20-slim
ARG NODE_ENV=development
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY prisma ./prisma/

RUN pnpm prisma generate

COPY . .

RUN if [ "$NODE_ENV" = "production" ]; then \
      pnpm build; \
    else \
      echo "Dev mode: skipping ahead-of-time build (handled by start:dev)"; \
    fi

ENV PORT=3001
EXPOSE 3001

CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start:prod"]
