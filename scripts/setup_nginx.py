import paramiko
import time

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

# Nginx configuration for QScrap
nginx_config = """
server {
    listen 80;
    listen [::]:80;
    server_name qscrap.qa www.qscrap.qa;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name qscrap.qa www.qscrap.qa;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/qscrap.qa/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qscrap.qa/privkey.pem;
    
    # Modern SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Proxy to backend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        
        # WebSocket support
        proxy_buffering off;
    }

    # Static file caching
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
"""

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("📦 Step 1: Installing Nginx and Certbot...")
    stdin, stdout, stderr = client.exec_command("""
        apt-get update -qq && 
        apt-get install -y nginx certbot python3-certbot-nginx -qq
    """)
    print(stdout.read().decode())
    
    print("\n🛑 Step 2: Stopping Caddy...")
    stdin, stdout, stderr = client.exec_command("docker stop caddy 2>/dev/null || true")
    print(stdout.read().decode())
    
    print("\n📝 Step 3: Creating initial Nginx config (HTTP only for cert)...")
    # First, create HTTP-only config to get certificate
    http_only_config = """
server {
    listen 80;
    listen [::]:80;
    server_name qscrap.qa www.qscrap.qa;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""
    stdin, stdout, stderr = client.exec_command(f"cat > /etc/nginx/sites-available/qscrap << 'NGINX_EOF'\n{http_only_config}\nNGINX_EOF")
    stdout.read()
    
    stdin, stdout, stderr = client.exec_command("ln -sf /etc/nginx/sites-available/qscrap /etc/nginx/sites-enabled/")
    stdout.read()
    
    stdin, stdout, stderr = client.exec_command("rm -f /etc/nginx/sites-enabled/default")
    stdout.read()
    
    stdin, stdout, stderr = client.exec_command("mkdir -p /var/www/certbot")
    stdout.read()
    
    print("\n🔄 Step 4: Starting Nginx...")
    stdin, stdout, stderr = client.exec_command("nginx -t && systemctl restart nginx")
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(f"Config test: {err}")
    
    print("\n🔐 Step 5: Obtaining SSL certificate...")
    stdin, stdout, stderr = client.exec_command("""
        certbot certonly --webroot -w /var/www/certbot \
            -d qscrap.qa -d www.qscrap.qa \
            --non-interactive --agree-tos \
            --email admin@qscrap.qa \
            --keep-until-expiring
    """)
    cert_out = stdout.read().decode()
    cert_err = stderr.read().decode()
    print(cert_out)
    if cert_err:
        print(cert_err)
    
    print("\n📝 Step 6: Applying full HTTPS Nginx config...")
    stdin, stdout, stderr = client.exec_command(f"cat > /etc/nginx/sites-available/qscrap << 'NGINX_EOF'\n{nginx_config}\nNGINX_EOF")
    stdout.read()
    
    print("\n🔄 Step 7: Reloading Nginx with SSL...")
    stdin, stdout, stderr = client.exec_command("nginx -t && systemctl reload nginx")
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(f"Result: {err}")
    
    print("\n✅ Nginx SSL setup complete!")
    print("🔗 Test: https://qscrap.qa")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
