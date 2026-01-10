
import paramiko
import time

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

# Robust Nginx configuration with dedicated socket.io block
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

    # Dedicated Socket.IO Location
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Crucial for WebSockets
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy to backend (Standard API/Web)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
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
    print(f"Connecting to {host}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("📝 Applying updated Nginx config...")
    # Escape strict string correctly for bash heredoc
    # We use a simple cat approach
    stdin, stdout, stderr = client.exec_command(f"cat > /etc/nginx/sites-available/qscrap << 'NGINX_EOF'\n{nginx_config}\nNGINX_EOF")
    if stdout.channel.recv_exit_status() != 0:
        print(stderr.read().decode())
        raise Exception("Failed to write config")

    print("🔗 Linking config just in case...")
    client.exec_command("ln -sf /etc/nginx/sites-available/qscrap /etc/nginx/sites-enabled/")

    print("🔄 Testing and Reloading Nginx...")
    stdin, stdout, stderr = client.exec_command("nginx -t && systemctl reload nginx")
    out = stdout.read().decode()
    err = stderr.read().decode()
    
    print(out)
    if err:
        print(f"Stderr: {err}")
        
    print("✅ Nginx updated and reloaded!")
    client.close()

except Exception as e:
    print(f"❌ Error: {e}")
