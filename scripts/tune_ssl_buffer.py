import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

# Adding ssl_buffer_size 4k;
nginx_config = """
server {
    listen 80;
    listen [::]:80;
    server_name qscrap.qa www.qscrap.qa;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name qscrap.qa www.qscrap.qa;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/qscrap.qa/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/qscrap.qa/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    
    # OPTIMIZATION: Reduce buffer size to prevent packet fragmentation/blocking
    ssl_buffer_size 4k;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript;

    # Main proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # Disable buffering for faster response
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # For WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_cache_bypass $http_upgrade;
    }
}
"""

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("📝 Applying Nginx SSL buffer optimization...")
    stdin, stdout, stderr = client.exec_command(f"cat > /etc/nginx/sites-available/qscrap << 'NGINX_EOF'\n{nginx_config}\nNGINX_EOF")
    stdout.read()
    
    print("🔄 Reloading Nginx...")
    stdin, stdout, stderr = client.exec_command("nginx -t && systemctl reload nginx")
    print(stderr.read().decode())
    
    print("✅ SSL buffer reduced to 4k.")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
