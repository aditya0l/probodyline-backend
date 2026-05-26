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

echo "🏗 Building project..."
npm run build

echo "🔄 Restarting PM2 app..."
pm2 restart probodyline

echo "⏳ Waiting for server to boot..."
sleep 5

echo "🩺 Checking health endpoint..."
curl -s http://localhost:3001/api/health || {
  echo "❌ Health check failed!"
  pm2 logs probodyline --lines 20
  exit 1
}

echo "================================"
echo "✅ Deployment successful!"
echo "================================"
