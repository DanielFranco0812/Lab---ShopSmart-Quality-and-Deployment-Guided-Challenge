# Deploying ShopSmart on AWS (single EC2 host, HTTPS)

## Decision record

| Decision | Choice | Why |
| --- | --- | --- |
| AWS plan | **Free plan** (new account): US$100 credits at sign-up, up to 6 months | No bill for a short classroom demo. The plan ends on the date shown in the AWS console; the demo must be removed before then. |
| Region | **Asia Pacific (Singapore) `ap-southeast-1`** | Closest Region; every resource is created here so cleanup is easy. |
| Layout | **One EC2 instance** runs Caddy (web entry), the built React site, the Express API and PostgreSQL | Fewest services for a short, fictional-data demo. Trade-off: one machine is a single point of failure, and we own updates, backups and cleanup. |
| HTTPS | **Caddy** with a free **DuckDNS** address (e.g. `shopsmart-daniel.duckdns.org`) | Caddy gets and renews a Let's Encrypt certificate automatically. Sign-in passwords and the session cookie never travel over plain HTTP. |
| Same origin | Website and API share one address; the site calls `/api` | No mixed-content or cross-site cookie problems; `VITE_API_URL=/api` is public and contains no secret. |
| Public ports | **443** (HTTPS) and **80** (only redirects to HTTPS); **22** (SSH) from my IP only | Express (3000) and PostgreSQL (5432) are internal: not opened in the security group. |
| Secrets | `DATABASE_URL`, `SESSION_SECRET`, `GEMINI_API_KEY` only in `backend/.env` on the server | Never committed (`.env` is git-ignored), never in a `VITE_` variable, never in screenshots. |
| Migrations | `npx prisma migrate deploy` | Applies committed migrations only and never deletes data. `npm run db:migrate` and `npm run db:seed` are never run on the server after the first setup (seed deletes all orders). |
| AI provider | Optional Gemini key; without it the assistant is **clearly labeled** "Built from catalog rules" | No paid provider required for the demo. |
| Access and data | Instructor and team; fictional customers only (e.g. `ana.test@example.com`) | No real names, emails, addresses or payments. |

## Resource register (fill in as you create things)

| Service | Name | Region | Owner | Purpose | Created | Remove by |
| --- | --- | --- | --- | --- | --- | --- |
| EC2 instance | shopsmart | ap-southeast-1 | | Runs the whole app | | |
| Elastic IP | shopsmart-ip | ap-southeast-1 | | Fixed public address for DuckDNS | | |
| EBS volume | (created with the instance) | ap-southeast-1 | | Disk, holds PostgreSQL data | | |
| Security group | shopsmart-sg | ap-southeast-1 | | Opens 80, 443 and SSH from my IP | | |
| DuckDNS name | | (external) | | HTTPS address | | |

## Steps

### 1. Account safety (once)
1. Turn on **MFA** for the root user (account name → Security credentials).
2. Check **Billing and Cost Management → Free Tier / Credits**: plan, credit balance, end date. Screenshot it with the account ID hidden.
3. **Budgets → Create budget → Zero spend budget** with your email.
4. Switch the Region to **Asia Pacific (Singapore)**.

### 2. Launch the server (EC2 → Launch instance)
- Name `shopsmart`; image **Ubuntu Server 24.04 LTS**; instance type marked **Free tier eligible** (e.g. `t3.micro`).
- Key pair: create `shopsmart` (RSA, `.pem`). Keep the file private.
- Network: create security group `shopsmart-sg` allowing **SSH from My IP**, **HTTP from anywhere**, **HTTPS from anywhere**.
- Storage: default (8 GB) is enough.

### 3. Give it a fixed address
EC2 → **Elastic IPs → Allocate**, then **Associate** it with the `shopsmart` instance. (A public IPv4 address uses a small amount of credit per hour while the demo runs.)

### 4. Get a free HTTPS name
Sign in at <https://www.duckdns.org>, add a sub-domain (e.g. `shopsmart-daniel`), and set its IP to the Elastic IP.

### 5. Connect (Windows PowerShell, in the folder with the `.pem` file)
```powershell
ssh -i shopsmart.pem ubuntu@<ELASTIC_IP>
```

### 6. Install the software (on the server)
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs postgresql git debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
node --version && psql --version && caddy version
```

### 7. Create the database (use a new random password)
```bash
DB_PASS=$(openssl rand -hex 16)
sudo -u postgres psql -c "CREATE USER shopsmart_user WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE shopsmart OWNER shopsmart_user;"
```

### 8. Get the code and write the server settings
```bash
cd ~ && git clone https://github.com/DanielFranco0812/Lab---ShopSmart-Quality-and-Deployment-Guided-Challenge.git shopsmart
cd ~/shopsmart
DOMAIN=shopsmart-daniel.duckdns.org   # your DuckDNS name
cat > backend/.env <<EOF
DATABASE_URL="postgresql://shopsmart_user:$DB_PASS@localhost:5432/shopsmart?schema=public"
PORT=3000
FRONTEND_URL=https://$DOMAIN
NODE_ENV=production
SESSION_SECRET=$(openssl rand -hex 32)
TRUST_PROXY=1
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
AI_TIMEOUT_MS=25000
GEMINI_THINKING_LEVEL=low
EOF
chmod 600 backend/.env
echo "VITE_API_URL=/api" > frontend/.env
```

### 9. Install, migrate, seed once, build
```bash
npm ci
npm run db:generate
cd backend && npx prisma migrate deploy && npx prisma migrate status && cd ..
npm run db:seed          # FIRST SETUP ONLY, on the empty database
npm run build
sudo mkdir -p /var/www/shopsmart && sudo cp -r frontend/dist/. /var/www/shopsmart/
```

### 10. Keep the API running (also after reboot)
```bash
sudo cp deploy/shopsmart-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shopsmart-api
curl -s http://127.0.0.1:3000/api/health
```

### 11. Turn on HTTPS
```bash
sed "s/{\$SHOPSMART_DOMAIN}/$DOMAIN/" deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```
Open `https://<your-name>.duckdns.org`. The first visit can take up to a minute while Caddy gets the certificate.

## Hosted checks (record expected and observed for each)

| Check | Expected |
| --- | --- |
| Frontend and direct route | Home shows 6 products; refreshing `/orders` or `/products/2` still shows the app |
| API connection | Browser DevTools → Network shows requests to `https://<name>.duckdns.org/api/...`; `/api/health` → `{"status":"ok"}` |
| Catalog and cart | Search, quantity and totals correct |
| Account and order | Guest: checkout says "Sign in to check out" and `GET /api/orders/<id>` → 401. Owner sees the order. Another customer gets "Order could not be found" (API 404) |
| Simulated checkout | Valid fictional order saved; short address or too many units refused |
| Assistant | Keyboard question links Product #2; "running shoes" is an honest no-match; label shows when AI is not configured |
| Restart and logs | `sudo systemctl restart shopsmart-api` then the site works and the customer is still signed in; `journalctl -u shopsmart-api -n 50` shows request lines, no secrets |
| Secrets and credits | No secret in the repo, browser files or screenshots; Billing shows credits within plan |

## Updating after a new commit
```bash
cd ~/shopsmart && ./deploy/update.sh
```

## Ending the demo
1. EC2 → **Terminate** the `shopsmart` instance (this deletes its disk and the database).
2. EC2 → Elastic IPs → **Release** the address.
3. Delete the security group, the key pair and the DuckDNS name.
4. Check Billing → Bills and Free Tier a day later.
