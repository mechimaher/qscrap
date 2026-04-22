import paramiko
import os

# VPS Credentials
host = "147.93.89.153"
user = "root"
password = os.getenv("VPS_PASS")

if not password:
    print("❌ ERROR: VPS_PASS environment variable is missing!")
    exit(1)

def run_script_remotely(client, local_path, label):
    print(f"\n--- {label} ---")
    if not os.path.exists(local_path):
        print(f"❌ Local script not found: {local_path}")
        return

    with open(local_path, 'r') as f:
        script_content = f.read()

    # Escape single quotes for the shell command
    escaped_content = script_content.replace("'", "'\\''")
    
    # We use 'docker exec -i' and pipe the script content to node
    # This avoids needing the file to exist inside the container
    cmd = f"echo '{escaped_content}' | docker exec -i qscrap-backend node -"
    
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    
    if out:
        print(out)
    if err:
        print(f"OUTPUT/ERROR: {err}")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    print(f"✅ Connected to VPS: {host}")

    # 1. Apply Database Fixes
    run_script_remotely(
        client, 
        "scripts/fix_production_db.js", 
        "Applying Database Schema Fixes"
    )

    # 2. Run SMTP Diagnostic
    run_script_remotely(
        client, 
        "scripts/test_smtp.js", 
        "Running SMTP Diagnostic Test"
    )

    client.close()
    print("\n--- Remote Execution Finished ---")
except Exception as e:
    print(f"❌ Connection failed: {e}")
