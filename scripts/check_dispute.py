import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔍 Checking disputes for order 4cf20f24...")
    cmd = 'docker exec -e PGPASSWORD=VeryStrongPassword123! qscrap-postgres psql -U postgres -d qscrap_db -c "SELECT * FROM disputes WHERE order_id = \'4cf20f24-dff5-48c9-a45b-6516f2d14dbf\';"'
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
