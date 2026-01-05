import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

# Caddyfile with HTTP/1.1 forced for backend connection
new_caddyfile = """qscrap.qa, www.qscrap.qa {
    reverse_proxy localhost:3000 {
        transport http {
            versions 1.1
        }
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
"""

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Write new Caddyfile
    caddyfile_path = "/opt/qscrap/Caddyfile"
    stdin, stdout, stderr = client.exec_command(f"cat > {caddyfile_path} << 'EOF'\n{new_caddyfile}EOF")
    stdout.read()
    
    print(f"New Caddyfile:\n{new_caddyfile}")
    
    # Reload Caddy
    print("🔄 Reloading Caddy...")
    stdin, stdout, stderr = client.exec_command("docker exec caddy caddy reload --config /etc/caddy/Caddyfile")
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(f"Reload output: {err}")
    
    print("✅ Caddy updated with HTTP/1.1 transport!")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
