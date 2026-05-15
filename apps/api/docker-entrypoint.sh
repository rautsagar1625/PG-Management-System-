#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Starting API server..."
exec node /app/apps/api/dist/main
