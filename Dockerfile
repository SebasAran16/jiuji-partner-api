FROM node:20-slim
ARG NODE_ENV=development
# procps provides `ps`, which nest-cli's tree-kill needs to stop the previous
# process on watch restarts — without it the old server survives and the new
# one dies with EADDRINUSE on 3001
RUN apt-get update && apt-get install -y openssl dumb-init ffmpeg procps && rm -rf /var/lib/apt/lists/*

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

RUN chmod +x /app/docker/scripts/run.sh /app/docker/scripts/run_development.sh

ENV PORT=3001
EXPOSE 3001

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "/app/docker/scripts/run.sh"]
