#!/bin/sh
# Migration and startup script for Railway

echo "Running database migrations..."

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set!"
  exit 1
fi

echo "DATABASE_URL is set, proceeding with migration..."

# Generate Prisma Client
npx prisma generate

# Run migrations
echo "Applying database migrations..."
npx prisma migrate deploy

# Check if migration was successful
if [ $? -eq 0 ]; then
  echo "✅ Migrations applied successfully"
else
  echo "❌ Migration failed, but continuing to start application..."
fi

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
