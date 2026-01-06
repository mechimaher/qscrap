import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("📂 Listing enabled sites:")
    stdin, stdout, stderr = client.exec_command("ls -F /etc/nginx/sites-enabled/")
    print(stdout.read().decode())
    
    print("🧪 Checking Backend Root (Port 3000):")
    stdin, stdout, stderr = client.exec_command("curl -I -s http://localhost:3000/")
    print(stdout.read().decode())
    
    print("🌍 Checking Nginx Root (Port 80):")
    stdin, stdout, stderr = client.exec_command("curl -I -s http://localhost/")
    print(stdout.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
