import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔧 Updating Nginx Config (Disable Gzip/Sendfile)...")
    # Replace the previous config with one that has sendfile off and gzip off
    # We use sed to just modify the specific lines because replacing the whole file again is verbose
    
    CMD_NGINX = """
    sed -i 's/gzip on;/gzip off;/g' /etc/nginx/sites-enabled/qscrap &&
    sed -i 's/proxy_buffering off;/proxy_buffering off; sendfile off; tcp_nopush off;/g' /etc/nginx/sites-enabled/qscrap
    """
    client.exec_command(CMD_NGINX)
    
    print("🔄 Reloading Nginx...")
    client.exec_command("systemctl reload nginx")
    
    print("✂️ Reducing MSS Clamp to 1200 bytes...")
    # Flush previous mangle rule to avoid duplicates?
    # iptables -t mangle -F OUTPUT
    # Re-apply with 1200
    
    CMD_MTU = """
    iptables -t mangle -F OUTPUT &&
    iptables -t mangle -A OUTPUT -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1200
    """
    stdin, stdout, stderr = client.exec_command(CMD_MTU)
    print(stderr.read().decode())
    
    print("✅ Applied: MSS 1200, Gzip OFF, Sendfile OFF.")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
