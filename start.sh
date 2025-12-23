#!/bin/sh
set -e

echo "🔧 Generating Prisma Client with runtime DATABASE_URL..."
npx prisma generate

echo "🚀 Starting application..."
exec node dist/main

