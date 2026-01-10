import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔄 Restarting qscrap-backend container...")
    stdin, stdout, stderr = client.exec_command("docker restart qscrap-backend")
    
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(f"STDERR: {err}")
        
    print("✅ Backend restarted successfully.")
    client.close()
except Exception as e:
    print(f"❌ Error: {e}")
