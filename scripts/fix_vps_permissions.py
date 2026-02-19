import paramiko
import os

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

def run_cmd(client, cmd, label):
    print(f"\n--- {label} ---")
    try:
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            print(out)
        if err:
            print(f"STDERR: {err}")
    except Exception as e:
        print(f"Failed: {e}")

try:
    print("🔌 Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    print("🛠️  Fixing permissions for /opt/qscrap/uploads...")
    
    # 1. Create directory if it doesn't exist
    run_cmd(client, 'mkdir -p /opt/qscrap/uploads/proofs', "Ensure directories exist")
    
    # 2. Set permissions to 777 (Read/Write/Execute for everyone) - The Hammer Approach
    # This ensures that whatever user the Docker container is running as (node/root) can write.
    run_cmd(client, 'chmod -R 777 /opt/qscrap/uploads', "Set chmod 777 on uploads")

    # 3. Verify
    run_cmd(client, 'ls -ld /opt/qscrap/uploads/proofs', "Verify Permissions")

    client.close()
    print("\n✅ Permission fix sequence completed.")
except Exception as e:
    print(f"\n❌ Connection or execution failed: {e}")
