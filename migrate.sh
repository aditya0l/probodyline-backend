#!/bin/bash
# Migration deployment script for Railway

echo "🚀 Running Prisma migration on Railway..."
npx prisma migrate deploy
echo "✅ Migration completed!"
