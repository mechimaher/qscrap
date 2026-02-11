import os
import paramiko

host = "147.93.89.153"
user = "root"
password = os.environ.get("VPS_PASSWORD", "")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("📋 Access Log (Last 20):")
    stdin, stdout, stderr = client.exec_command("tail -n 20 /var/log/nginx/access.log")
    print(stdout.read().decode())
    
    print("\n⚠️ Error Log (Last 20):")
    stdin, stdout, stderr = client.exec_command("tail -n 20 /var/log/nginx/error.log")
    print(stdout.read().decode())
    
    print("\n🛡️ IPTables Counters:")
    stdin, stdout, stderr = client.exec_command("iptables -t mangle -L OUTPUT -v -n")
    print(stdout.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
