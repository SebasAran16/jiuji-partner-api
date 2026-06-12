#!/bin/bash
set -e

cd /app && pnpm prisma generate && pnpm prisma migrate deploy && npx prisma db seed && pnpm start:debug
