import paramiko
import time

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    print(f"🚀 Connecting to {host}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Command to rebuild and restart containers
    CMD = "cd /opt/qscrap && docker compose down && docker compose up -d --build"
    
    print("🔄 Executing Deployment (Down + Build + Up)...")
    print(f"Command: {CMD}")
    
    stdin, stdout, stderr = client.exec_command(CMD)
    
    # Stream output
    while True:
        line = stdout.readline()
        if not line:
            break
        print(line.strip())
        
    error_output = stderr.read().decode()
    if error_output:
        print(f"Note (stderr): {error_output}")
    
    print("⏳ Waiting 10s for services to stabilize...")
    time.sleep(10)
    
    # Health check
    print("🏥 Checking container status...")
    stdin, stdout, stderr = client.exec_command("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    print(stdout.read().decode())
    
    client.close()
    print("\n✅ Deployment Command Completed.")
    
except Exception as e:
    print(f"❌ Error: {e}")
