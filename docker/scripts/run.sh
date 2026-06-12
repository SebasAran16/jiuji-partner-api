#!/bin/bash
set -e

if [ "${1#-}" != "$1" ]; then
    set -- node "$@"
fi

cd /app && pnpm prisma migrate deploy && pnpm start:prod
