import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Check Caddy certificate location
    print("🔍 Checking Caddy certificates...")
    stdin, stdout, stderr = client.exec_command("""
        docker exec caddy ls -la /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/ 2>/dev/null || echo "Caddy not running"
    """)
    print(stdout.read().decode())
    
    # Find the actual cert files
    stdin, stdout, stderr = client.exec_command("""
        docker exec caddy find /data/caddy/certificates -name "*.crt" -o -name "*.key" 2>/dev/null | head -20
    """)
    print("Certificate files found:")
    print(stdout.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
