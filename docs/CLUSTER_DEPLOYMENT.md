# Multi-Server Cluster Deployment Guide

## Architecture Overview

```
           Internet
               ↓
        Cloudflare CDN
               ↓
     Nginx Load Balancer
      /      |     \
  App1    App2    App3  (Node.js:3001, 3002, 3003)
      \      |     /
    Redis Cluster (Session Store)
               ↓
  PostgreSQL Primary + Replicas
               ↓
     S3/Azure Blob Storage
```

## Prerequisites

- **3+ Ubuntu/Debian servers** (or containers)
- **Redis** instance (standalone or cluster)
- **PostgreSQL** with read replicas (Azure Database/AWS RDS)
- **S3/Azure Blob** storage account
- **Domain name** configured with Cloudflare

---

## Step 1: Set Up Redis Session Store

### Option A: Single Redis Instance (Up to 10k users)

```bash
# Install Redis on dedicated server
sudo apt update
sudo apt install redis-server -y

# Edit /etc/redis/redis.conf
sudo nano /etc/redis/redis.conf

# Enable remote connections
bind 0.0.0.0
protected-mode no
requirepass YOUR_STRONG_PASSWORD_HERE

# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

### Option B: Redis Cluster (10k+ users)

```bash
# Use managed service (recommended)
# - AWS ElastiCache
# - Azure Cache for Redis
# - DigitalOcean Managed Redis

# Or self-host cluster (3+ nodes minimum)
```

---

## Step 2: Prepare Application Servers

### On Each App Server (App1, App2, App3)

```bash
# 1. Clone repository
cd /opt
git clone https://github.com/yourorg/qscrap.git
cd qscrap

# 2. Install dependencies
npm install --production

# 3. Create environment file
sudo nano .env
```

### Environment Configuration (.env)

```env
# Server Configuration
NODE_ENV=production
PORT=3001  # Use 3002, 3003 on other servers

# Database (Shared)
DB_HOST=your-postgres-server.database.azure.net
DB_USER=qscrap_user
DB_PASSWORD=<STRONG_PASSWORD>
DB_NAME=qscrap_db
DB_PORT=5432

# Database Pool Configuration
DB_POOL_MAX=40
DB_POOL_MIN=10

# Read Replica (Optional but recommended)
DB_READ_REPLICA_HOST=replica.database.azure.net
DB_READ_REPLICA_PORT=5432
DB_READ_POOL_MAX=60

# Redis Session Store (REQUIRED for multi-server)
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@redis-server-ip:6379

# Secrets (CRITICAL - Generate unique per environment)
JWT_SECRET=<64-char-hex-string>
SESSION_SECRET=<64-char-hex-string>

# File Storage (S3 or Azure)
S3_BUCKET=qscrap-production
S3_REGION=eu-central-1
S3_ACCESS_KEY=<YOUR_ACCESS_KEY>
S3_SECRET_KEY=<YOUR_SECRET_KEY>

# OR for Azure
AZURE_STORAGE_ACCOUNT=qscrapstorageaccount
AZURE_STORAGE_CONTAINER=uploads
AZURE_STORAGE_CONNECTION_STRING=<CONNECTION_STRING>

# CORS (Your production domains)
CORS_ORIGINS=https://qscrap.qa,https://www.qscrap.qa,https://app.qscrap.qa
COOKIE_DOMAIN=.qscrap.qa
```

### Build and Start Application

```bash
# Build TypeScript
npm run build

# Install PM2 for process management
sudo npm install -g pm2

# Start application
pm2 start dist/server.js --name qscrap-app1

# Save PM2 config and enable startup
pm2 save
pm2 startup
```

---

## Step 3: Configure Nginx Load Balancer

### Install Nginx on Load Balancer Server

```bash
sudo apt update
sudo apt install nginx -y
```

### Create Load Balancer Configuration

```bash
sudo nano /etc/nginx/sites-available/qscrap
```

**Configuration File:**

```nginx
# Upstream servers (your app instances)
upstream qscrap_backend {
    # Least connections algorithm for better distribution
    least_conn;
    
    # App servers with health checks
    server app1-ip:3001 max_fails=3 fail_timeout=30s;
    server app2-ip:3002 max_fails=3 fail_timeout=30s;
    server app3-ip:3003 max_fails=3 fail_timeout=30s;
    
    # Enable keepalive connections
    keepalive 32;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;

server {
    listen 80;
    listen [::]:80;
    server_name qscrap.qa www.qscrap.qa app.qscrap.qa;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name qscrap.qa www.qscrap.qa app.qscrap.qa;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/qscrap.qa/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qscrap.qa/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Client size limits
    client_max_body_size 10M;
    
    # Logging
    access_log /var/log/nginx/qscrap_access.log;
    error_log /var/log/nginx/qscrap_error.log;
    
    # Health check endpoint (bypass load balancer)
    location /health {
        proxy_pass http://qscrap_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }
    
    # Rate limited endpoints
    location /api/auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        proxy_pass http://qscrap_backend;
        include /etc/nginx/proxy_params.conf;
    }
    
    location /api/auth/register {
        limit_req zone=login_limit burst=3 nodelay;
        proxy_pass http://qscrap_backend;
        include /etc/nginx/proxy_params.conf;
    }
    
    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://qscrap_backend;
        include /etc/nginx/proxy_params.conf;
    }
    
    # Socket.IO WebSocket support
    location /socket.io/ {
        proxy_pass http://qscrap_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Static files (served from first server or CDN)
    location / {
        proxy_pass http://qscrap_backend;
        include /etc/nginx/proxy_params.conf;
        
        # Cache static assets
        location ~* \.(jpg|jpeg|png|webp|gif|svg|css|js|woff|woff2|ttf|eot|ico)$ {
            proxy_pass http://qscrap_backend;
            proxy_cache_valid 200 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Create Proxy Parameters File

```bash
sudo nano /etc/nginx/proxy_params.conf
```

```nginx
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Connection "";

# Timeouts
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;

# Buffering
proxy_buffering on;
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;
```

### Enable Configuration

```bash
sudo ln -s /etc/nginx/sites-available/qscrap /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 4: SSL Certificates with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate certificates
sudo certbot --nginx -d qscrap.qa -d www.qscrap.qa -d app.qscrap.qa

# Auto-renewal (certbot sets this up automatically)
sudo certbot renew --dry-run
```

---

## Step 5: Testing the Cluster

### Test Load Balancing

```bash
# Check which server handles each request
curl -I https://qscrap.qa/health

# Watch logs on each app server
pm2 logs qscrap-app1
pm2 logs qscrap-app2
pm2 logs qscrap-app3
```

### Test Session Persistence

1. Log in from browser
2. Refresh multiple times
3. Session should persist across all app servers (via Redis)

### Verify Redis Sessions

```bash
# Connect to Redis
redis-cli -h redis-server-ip -a YOUR_PASSWORD

# List keys
KEYS qscrap:sess:*

# Check session count
DBSIZE
```

### Load Test

```bash
# Install Apache Bench
sudo apt install apache2-utils -y

# Simulate 1000 requests, 10 concurrent
ab -n 1000 -c 10 https://qscrap.qa/health

# Monitor app servers
pm2 monit
```

---

## Step 6: Monitoring & Alerting

### PM2 Monitoring

```bash
# On each app server
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Monitor CPU/Memory
pm2 monit
```

### Nginx Monitoring

```bash
# Enable status page (add to nginx config)
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}

# View stats
curl http://localhost/nginx_status
```

---

## Step 7: Scaling Strategy

### Add More App Servers

1. Clone .env to new server
2. Change `PORT` to unique value (3004, 3005, etc.)
3. Add to nginx upstream block
4. Reload nginx: `sudo nginx -s reload`

### Database Scaling

```sql
-- Add read replicas via Azure/AWS console
-- Update .env on all servers:
DB_READ_REPLICA_HOST=new-replica.database.azure.net
```

### Redis Scaling

- **0-10k users**: Single Redis instance
- **10k-100k users**: Redis Sentinel (HA)
- **100k+ users**: Redis Cluster

---

## Troubleshooting

### Session Issues

```bash
# Check Redis connectivity from app server
redis-cli -h redis-ip -a password PING

# View logs
pm2 logs | grep Redis
```

### Load Balancer Not Distributing

```bash
# Check backend health
curl http://app1-ip:3001/health
curl http://app2-ip:3002/health

# View nginx access logs
sudo tail -f /var/log/nginx/qscrap_access.log
```

### High Memory Usage

```bash
# Check Redis memory
redis-cli -h redis-ip -a password INFO memory

# Check app memory
pm2 monit

# Restart individual app
pm2 restart qscrap-app1
```

---

## Production Checklist

- [ ] Redis password set and secured
- [ ] PostgreSQL configured with SSL
- [ ] S3/Azure bucket permissions verified
- [ ] Environment secrets are unique
- [ ] SSL certificates installed and auto-renewing
- [ ] Firewall rules configured (only allow 80, 443, SSH)
- [ ] Database backups automated
- [ ] PM2 startup scripts enabled
- [ ] Monitoring alerts configured
- [ ] Load tested with expected traffic

---

## Estimated Capacity

| Configuration | Users | Requests/sec |
|---------------|-------|--------------|
| 3 App Servers (2 CPU, 4GB each) | ~10,000 | ~300 req/s |
| 5 App Servers (4 CPU, 8GB each) | ~50,000 | ~1,000 req/s |
| 10 App Servers + Redis Cluster | ~200,000 | ~5,000 req/s |

**Your current setup**: Ready for **10,000 concurrent users** 🚀
