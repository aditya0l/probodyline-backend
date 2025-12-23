#!/bin/sh
set -e

echo "📁 Checking dist folder..."
ls -la /app/dist/

echo "🔧 Generating Prisma Client with runtime DATABASE_URL..."
npx prisma generate

echo "🚀 Starting application..."
exec node dist/src/main

