import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🧪 Checking HTTP on port 3000...")
    stdin, stdout, stderr = client.exec_command("curl -I -s http://localhost:3000/operations-dashboard.html | head -5")
    print(stdout.read().decode())
    
    print("🔒 Checking HTTPS on port 443 (via Nginx)...")
    stdin, stdout, stderr = client.exec_command("curl -I --insecure -s https://localhost/operations-dashboard.html | head -5")
    print(stdout.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
