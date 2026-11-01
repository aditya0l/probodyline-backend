#!/bin/bash

set -e

echo "================================"
echo "🚀 Starting deployment..."
echo "================================"

cd ~/probodyline-backend

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🗄 Syncing database schema..."
npx prisma migrate deploy

echo "🏗 Building project..."
npm run build

echo "🔄 Restarting PM2 app..."
pm2 restart probodyline

echo "⏳ Waiting for server to boot..."
sleep 5

echo "🩺 Checking health endpoint..."
# /api/health needs a token, so a 401 still proves the app booted and is routing.
# Fail on no answer (000) or a 5xx after ~60s of retries.
STATUS=000
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || true)
  if [ "$STATUS" != "000" ] && [ "$STATUS" -lt 500 ]; then
    break
  fi
  sleep 2
done

if [ "$STATUS" = "000" ] || [ "$STATUS" -ge 500 ]; then
  echo "❌ Health check failed! (HTTP $STATUS)"
  pm2 logs probodyline --lines 20 --nostream
  exit 1
fi
echo "Server answered with HTTP $STATUS"

echo "================================"
echo "✅ Deployment successful!"
echo "================================"
