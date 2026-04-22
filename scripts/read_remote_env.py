import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    print("--- Remote .env SMTP Config ---")
    stdin, stdout, stderr = client.exec_command("cat /opt/qscrap/.env | grep -E 'SMTP|SENDGRID'")
    print(stdout.read().decode().strip())
    
    client.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
