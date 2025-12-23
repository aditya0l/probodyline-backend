#!/bin/sh
# Migration and startup script for Railway

echo "Running database migrations..."
# Ensure Prisma Client is generated with the runtime DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set; using dummy connection for prisma generate"
  export DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy?schema=public"
fi
npx prisma generate
npx prisma migrate deploy

echo "Seeding database (using built seed)..."
if [ -f "dist/prisma/seed.js" ]; then
  node dist/prisma/seed.js || echo "Seed failed or already seeded"
elif [ -f "prisma/seed.ts" ]; then
  npx ts-node prisma/seed.ts || echo "Seed failed or already seeded (ts-node)"
else
  echo "Seed script not found (skipping)"
fi

echo "Starting application..."
node dist/src/main.js

