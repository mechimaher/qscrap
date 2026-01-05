import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    print(f"🔄 Restarting backend on {host}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    stdin, stdout, stderr = client.exec_command("cd /opt/qscrap && docker compose restart backend")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    client.close()
    print("✅ Backend restarted!")
except Exception as e:
    print(f"❌ Error: {e}")
