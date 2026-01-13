import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("📋 Fetching backend logs...")
    stdin, stdout, stderr = client.exec_command("docker logs --tail 100 qscrap-backend")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
