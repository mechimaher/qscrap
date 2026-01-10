import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔍 Checking ALL disputes for garage 6cbc4d4b-7c98-4508-9dba-5a4372351b20...")
    cmd = 'docker exec -e PGPASSWORD=VeryStrongPassword123! qscrap-postgres psql -U postgres -d qscrap_db -c "SELECT * FROM disputes WHERE garage_id = \'6cbc4d4b-7c98-4508-9dba-5a4372351b20\' AND status = \'pending\';"'
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
