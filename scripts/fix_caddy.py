import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

# New Caddyfile that uses host networking or container name
new_caddyfile = """qscrap.qa, www.qscrap.qa {
    reverse_proxy host.docker.internal:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
"""

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Check how Caddy was started
    print("=== CHECKING CADDY DOCKER CONFIG ===")
    stdin, stdout, stderr = client.exec_command("docker inspect caddy --format '{{json .HostConfig.NetworkMode}}'")
    network_mode = stdout.read().decode().strip()
    print(f"Network mode: {network_mode}")
    
    stdin, stdout, stderr = client.exec_command("docker inspect caddy --format '{{json .HostConfig.ExtraHosts}}'")
    extra_hosts = stdout.read().decode().strip()
    print(f"Extra hosts: {extra_hosts}")
    
    # Check if host.docker.internal works or if we need to add it
    stdin, stdout, stderr = client.exec_command("docker exec caddy ping -c 1 host.docker.internal 2>&1 || echo 'host.docker.internal not available'")
    result = stdout.read().decode()
    print(f"Host.docker.internal test: {result}")
    
    # If host.docker.internal doesn't work, we need to use the host IP
    if 'not available' in result or 'bad address' in result.lower():
        print("\n⚠️ host.docker.internal not available, using host IP instead")
        # Get host IP
        stdin, stdout, stderr = client.exec_command("hostname -I | awk '{print $1}'")
        host_ip = stdout.read().decode().strip()
        print(f"Host IP: {host_ip}")
        
        new_caddyfile = f"""qscrap.qa, www.qscrap.qa {{
    reverse_proxy {host_ip}:3000 {{
        header_up Host {{host}}
        header_up X-Real-IP {{remote_host}}
    }}
}}
"""
    
    # Find Caddyfile location
    stdin, stdout, stderr = client.exec_command("docker inspect caddy --format '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}'")
    mounts = stdout.read().decode().strip()
    print(f"\nCaddy mounts: {mounts}")
    
    # Update the Caddyfile
    stdin, stdout, stderr = client.exec_command("cat /etc/caddy/Caddyfile 2>/dev/null || cat /opt/caddy/Caddyfile 2>/dev/null || docker exec caddy cat /etc/caddy/Caddyfile")
    current_caddyfile = stdout.read().decode()
    print(f"\nCurrent Caddyfile:\n{current_caddyfile}")
    
    print(f"\nNew Caddyfile:\n{new_caddyfile}")
    
    # Write new Caddyfile
    caddyfile_path = "/etc/caddy/Caddyfile"
    stdin, stdout, stderr = client.exec_command(f"cat > {caddyfile_path} << 'EOF'\n{new_caddyfile}\nEOF")
    stdout.read()  # Wait for command to complete
    
    # Reload Caddy
    print("\n🔄 Reloading Caddy...")
    stdin, stdout, stderr = client.exec_command("docker exec caddy caddy reload --config /etc/caddy/Caddyfile")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    print("✅ Caddy configuration updated!")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
