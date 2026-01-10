import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔍 Fetching recent orders...")
    cmd = 'docker exec -e PGPASSWORD=VeryStrongPassword123! qscrap-postgres psql -U postgres -d qscrap_db -c "SELECT order_id, order_number, order_status, created_at, garage_id FROM orders ORDER BY created_at DESC LIMIT 5;"'
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
