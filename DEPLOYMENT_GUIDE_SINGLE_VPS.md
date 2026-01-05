# QScrap Single VPS Deployment Guide (Phase 2)

**Target Infrastructure**: Hostinger KVM 2 (2 vCPU / 8GB RAM) or KVM 4.
**Capacity**: ~2,000+ Concurrent Users.
**Recommended OS**: Ubuntu 22.04 or 24.04 64-bit.

---

## 🚀 Step 1: Initial Server Setup
Connect to your VPS:
```bash
ssh root@<your-vps-ip>
```

Update system and install Docker:
```bash
# Update Ubuntu
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y
```

---

## 📦 Step 2: Deploy the Code
You can clone from GitHub (easiest) or copy files via SFTP.

```bash
# 1. Clone your repo
cd /opt
git clone https://github.com/mechimaher/qscrap.git
cd qscrap

# 2. Set up environment variables
cp .env.example .env
nano .env
```

**Edit your `.env` for production:**
```env
NODE_ENV=production
# Generate a strong password here!
DB_PASSWORD=VeryStrongPassword123!
JWT_SECRET=AnotherStrongSecretKeyHere
# Public domain
DOMAIN=qscrap.qa
```

---

## 🛡️ Step 3: Start the System
Run the app in detached mode.

```bash
docker compose up -d --build
```

Verify it's running:
```bash
docker ps
# You should see 'qscrap-backend' and 'qscrap-postgres' running.
```

---

## 🔒 Step 4: Setup SSL (HTTPS) with Caddy (Easiest Method)
Instead of configuring Nginx manually, we use **Caddy** which handles SSL automatically.

1. Create a `Caddyfile` in the root folder:
```bash
nano Caddyfile
```
Content:
```caddy
qscrap.qa, www.qscrap.qa {
    reverse_proxy localhost:3000
}
```

2. Run Caddy with Docker:
```bash
docker run -d \
    --name caddy \
    --network host \
    -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
    -v caddy_data:/data \
    caddy:alpine
```

**Done!** Your site `https://qscrap.qa` is now live with padlock HTTPS.

---

## 🔄 Updating the App
When you push changes to GitHub, deploy them like this:

```bash
# 1. Pull changes
git pull origin main

# 2. Rebuild and restart (Zero downtime usually not guaranteed here, takes ~20s)
docker compose up -d --build
```

## 🚑 Troubleshooting
- **Logs**: `docker logs -f qscrap-backend`
- **Restart**: `docker compose restart`
