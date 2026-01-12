import paramiko
import time

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

def run_command(client, cmd):
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    # Wait for command to complete
    exit_status = stdout.channel.recv_exit_status() 
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    return exit_status, out, err

try:
    print("🔌 Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # 1. Verify Container
    print("\n🔍 Checking for DB Container (qscrap-postgres)...")
    status, out, err = run_command(client, "docker ps | grep qscrap-postgres")
    if status != 0 or "qscrap-postgres" not in out:
        print("❌ Container 'qscrap-postgres' not found running.")
        print(f"Docker PS Output:\n{out}")
        exit(1)
    else:
        print("✅ Container found.")

    # 2. Check DB Connectivity & List Tables
    print("\n🔍 Checking DB Connection & Tables...")
    # Using default user 'postgres' and db 'qscrap_db'
    cmd_base = "docker exec qscrap-postgres psql -U postgres -d qscrap_db -c"
    
    status, out, err = run_command(client, f'{cmd_base} "\\dt"')
    if status != 0:
        print(f"❌ Failed to list tables.\nSTDERR: {err}")
    else:
        print(f"✅ Tables:\n{out}")

    # 3. Investigate Order
    order_num = "QS-2601-0023"
    print(f"\n📦 Investigating Order: {order_num}")
    
    queries = [
        ("Order Details", f"SELECT order_id, order_number, order_status, created_at, garage_id, customer_id, total_amount FROM orders WHERE order_number = '{order_num}';"),
        ("Assignments", f"SELECT da.assignment_id, da.status, da.driver_id, da.created_at, da.updated_at FROM delivery_assignments da JOIN orders o ON da.order_id = o.order_id WHERE o.order_number = '{order_num}';"),
        ("Status History", f"SELECT old_status, new_status, changed_by_type, reason, created_at FROM order_status_history WHERE order_id = (SELECT order_id FROM orders WHERE order_number = '{order_num}') ORDER BY created_at DESC;"),
        ("Invoices", f"SELECT invoice_id, status, amount, created_at FROM invoices WHERE order_id = (SELECT order_id FROM orders WHERE order_number = '{order_num}');")
    ]

    for title, query in queries:
        print(f"\n--- {title} ---")
        # Escape double quotes in query if any (none in my simple queries, but good practice)
        safe_query = query.replace('"', '\\"')
        full_cmd = f'{cmd_base} "{safe_query}"'
        status, out, err = run_command(client, full_cmd)
        if status != 0:
            print(f"❌ Error:\n{err}")
        else:
            print(out if out else "<No Results>")

    client.close()

except Exception as e:
    print(f"❌ Script Error: {e}")
