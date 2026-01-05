import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

commands = [
    "echo '=== LISTENING PORTS ===' && netstat -tlnp 2>/dev/null | grep -E ':80|:443|:3000' || ss -tlnp | grep -E ':80|:443|:3000'",
    "echo '=== CADDY STATUS ===' && (systemctl status caddy --no-pager 2>/dev/null || echo 'Caddy not installed as service')",
    "echo '=== NGINX STATUS ===' && (systemctl status nginx --no-pager 2>/dev/null || echo 'Nginx not installed')",
    "echo '=== DOCKER CONTAINERS ===' && docker ps --format 'table {{.Names}}\t{{.Ports}}'",
    "echo '=== CADDYFILE ===' && (cat /etc/caddy/Caddyfile 2>/dev/null || cat /opt/qscrap/Caddyfile 2>/dev/null || echo 'No Caddyfile found')"
]

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    for cmd in commands:
        stdin, stdout, stderr = client.exec_command(cmd)
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err and 'Warning' not in err:
            print(f"STDERR: {err}")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
