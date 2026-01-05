import paramiko
import time

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"
command = "cd /opt/qscrap && docker compose logs --tail=100 backend"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    stdin, stdout, stderr = client.exec_command(command)
    
    print("--- STANDARD OUTPUT ---")
    print(stdout.read().decode())
    print("--- STANDARD ERROR ---")
    print(stderr.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
