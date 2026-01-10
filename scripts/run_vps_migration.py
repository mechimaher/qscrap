import paramiko
import time

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🚀 Running migration on VPS...")
    
    # Path might be different if not pulled yet, but sync_vps.py should ensure it's there.
    # We'll use the file from the repo: scripts/migrations/001_create_sub_requests.sql
    
    MIGRATION_CMD = "docker exec -i qscrap-postgres psql -U postgres -d qscrap_db < /opt/qscrap/scripts/migrations/001_create_sub_requests.sql"
    
    stdin, stdout, stderr = client.exec_command(MIGRATION_CMD)
    
    out = stdout.read().decode()
    err = stderr.read().decode()
    
    if out:
        print(f"STDOUT: {out}")
    if err:
        # psql prints notices/messages to stderr sometimes, not always fail
        print(f"STDERR: {err}")
        
    print("✅ Migration checks complete.")
    
    client.close()
except Exception as e:
    print(f"❌ Error: {e}")
