import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

order_id = "4cf20f24-dff5-48c9-a45b-6516f2d14dbf"
order_number = "QS-2601-0010"

sql_commands = [
    "BEGIN;",
    f"DELETE FROM disputes WHERE order_id = '{order_id}';",
    f"DELETE FROM delivery_assignments WHERE order_id = '{order_id}';",
    f"DELETE FROM order_reviews WHERE order_id = '{order_id}';",
    f"DELETE FROM orders WHERE order_id = '{order_id}';",
    "COMMIT;"
]

full_command = f"""docker exec -e PGPASSWORD=VeryStrongPassword123! qscrap-postgres psql -U postgres -d qscrap_db -c "{' '.join(sql_commands)}" """

try:
    print(f"🗑️ Deleting Order {order_number} ({order_id}) and related rows...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    stdin, stdout, stderr = client.exec_command(full_command)
    out = stdout.read().decode()
    err = stderr.read().decode()
    
    print(out)
    if err:
        print("STDERR:", err)
        
    client.close()
    print("✅ Deletion attempted.")

except Exception as e:
    print(f"❌ Error: {e}")
