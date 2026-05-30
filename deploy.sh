#!/bin/bash

# ==============================================================================
# Daily Meal VPS Auto-Deployment Script
# Enforces complete clean pull, server build, client PWA export, and Nginx reload.
# ==============================================================================

# Ensure script stops on first error
set -e

echo "🚀 Starting Daily Meal Auto-Deployment..."

# 1. Navigate to project root
cd "$(dirname "$0")"
echo "📂 Working directory: $(pwd)"

# 2. Reset VPS package-lock.json local changes to prevent git pull conflicts
echo "🧹 Cleaning up local file changes..."
git checkout package-lock.json || true
git checkout server/daily-meal-api.conf || true

# 3. Pull latest changes from GitHub
echo "🔄 Pulling latest updates from GitHub..."
git pull

# 4. Clean install dependencies
echo "📦 Installing npm dependencies..."
npm ci

# 5. Build and restart Express Server (API)
echo "⚙️ Building and restarting Express Server..."
npm run build
pm2 restart daily-meal-api || pm2 start ecosystem.config.cjs
pm2 save

# 6. Build and deploy client Progressive Web App (PWA)
echo "🌐 Exporting Expo Web PWA..."
npm --workspace client run build:web

echo "📂 Deploying PWA to /var/www/daily-meal..."
sudo mkdir -p /var/www/daily-meal
sudo rsync -a --delete client/dist/ /var/www/daily-meal/
sudo chown -R nginx:nginx /var/www/daily-meal

# 7. Reload Nginx to apply any changes
echo "🔧 Reloading Nginx server configuration..."
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Deployment completed successfully! Daily Meal is live."
pm2 status
