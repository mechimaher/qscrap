import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Get Caddy logs
    stdin, stdout, stderr = client.exec_command("docker logs caddy --tail=50 2>&1")
    print("=== CADDY LOGS ===")
    print(stdout.read().decode())
    
    # Check if certificate exists
    stdin, stdout, stderr = client.exec_command("docker exec caddy ls -la /data/caddy/certificates/ 2>&1 || echo 'No certificates directory'")
    print("\n=== CERTIFICATES ===")
    print(stdout.read().decode())
    
    # Test internal connection from Caddy to backend
    stdin, stdout, stderr = client.exec_command("docker exec caddy wget -qO- http://localhost:3000/ 2>&1 || docker exec caddy curl -s http://localhost:3000/ 2>&1 || echo 'Cannot reach backend from caddy'")
    print("\n=== CADDY -> BACKEND TEST ===")
    print(stdout.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
