#!/bin/sh
# Migration and startup script for Railway

echo "Running database migrations..."
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

