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

> [!TIP]
> **Option A: HTTPS (Simplest)**
> Use the command below. When asked for password, use a **Personal Access Token**.
> `git clone https://github.com/mechimaher/qscrap.git`
>
> **Option B: SSH (Recommended for Pros)**
> If you prefer using `git@github.com:...`:
> 1. Run `ssh-keygen -t ed25519` (Press Enter for all).
> 2. Run `cat /root/.ssh/id_ed25519.pub` and copy the output.
> 3. Go to GitHub -> Settings -> SSH Keys -> New Key -> Paste it.
> 4. Run `git clone git@github.com:mechimaher/qscrap.git`

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

## 🔒 Step 4: Setup SSL (HTTPS) with Nginx
We use **Nginx** for robust performance and better control over HTTP protocols (resolves HTTP/2 connectivity issues in some regions).

1. **Install Nginx & Certbot**:
```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
```

2. **Configure Nginx**:
Create `/etc/nginx/sites-available/qscrap`:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name qscrap.qa www.qscrap.qa;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name qscrap.qa www.qscrap.qa;

    ssl_certificate /etc/letsencrypt/live/qscrap.qa/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qscrap.qa/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;  # Important for streaming/performance
    }
}
```

3. **Enable Site & Get Certificate**:
```bash
ln -s /etc/nginx/sites-available/qscrap /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
service nginx restart

# Get SSL Certificate
certbot --nginx -d qscrap.qa -d www.qscrap.qa
```

**Done!** Your site `https://qscrap.qa` is now live with padlock HTTPS and robust HTTP/1.1 support.

---

---

## 🌐 Step 5: DNS Configuration (Critical)
To ensure reliable connectivity, your Domain Name System (DNS) must be configured correctly.

1. **Option A: Hostinger DNS (Simpler)**
   - Login to your Domain Registrar (e.g., qhost.qa).
   - Change Nameservers to: `ns1.dns-parking.com`, `ns2.dns-parking.com`.
   - In Hostinger Dashboard: Create **A Record** for `@` pointing to your VPS IP (`$VPS_HOST`).

2. **Option B: Cloudflare DNS (Recommended for Speed/Security)**
   - Sign up for Cloudflare and add `qscrap.qa`.
   - Change Nameservers at your Registrar to the ones provided by Cloudflare.
   - In Cloudflare: Create **A Record** for `@` pointing to `$VPS_HOST` (Proxy Status: DNS Only initially, then Proxied).

**Troubleshooting:**
If `https://IP_ADDRESS` works fast but `https://DOMAIN` is slow/timeout, the issue is almost always **DNS Misconfiguration** or ISP throttling of the domain name. Switching to Cloudflare usually prevents this.

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
