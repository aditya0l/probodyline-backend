#!/bin/sh
# Migration and startup script for Railway

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npm run prisma:seed || echo "Seed failed or already seeded"

echo "Starting application..."
node dist/main

