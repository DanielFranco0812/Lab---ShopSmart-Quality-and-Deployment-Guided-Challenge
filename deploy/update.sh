#!/usr/bin/env bash
# Updates the running ShopSmart on the server to the latest GitHub version.
# Safe for existing data: it applies committed migrations only and NEVER runs the seed script.
set -euo pipefail
cd /home/ubuntu/shopsmart

echo "1/6 Getting the latest code"
git pull --ff-only

echo "2/6 Installing packages"
npm ci

echo "3/6 Preparing the database client"
npm run db:generate

echo "4/6 Applying new database migrations (keeps existing data)"
(cd backend && npx prisma migrate deploy)

echo "5/6 Building the website"
npm run build
sudo rm -rf /var/www/shopsmart
sudo mkdir -p /var/www/shopsmart
sudo cp -r frontend/dist/. /var/www/shopsmart/

echo "6/6 Restarting the API"
sudo systemctl restart shopsmart-api
sleep 2
curl -fsS http://127.0.0.1:3000/api/health && echo " <- API health"
git log -1 --format='Deployed commit %h (%s)'
