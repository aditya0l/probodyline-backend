#!/bin/sh
# Migration and startup script for Railway

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database (using built seed)..."
if [ -f "dist/prisma/seed.js" ]; then
  node dist/prisma/seed.js || echo "Seed failed or already seeded"
else
  echo "Seed script not found at dist/prisma/seed.js (skipping)"
fi

echo "Starting application..."
node dist/src/main.js

