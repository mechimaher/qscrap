import paramiko
import os

# VPS Credentials
host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

def run_remote_cmd(client, cmd, label):
    print(f"\n--- {label} ---")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err:
        print(f"OUTPUT: {err}")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    print(f"✅ Connected to VPS: {host}")

    # 1. Disable API Caching in app.ts
    # We will modify the cacheControl middleware to use 'no-store' for API requests
    disable_cache_cmd = """
    cd /opt/qscrap && 
    sed -i "s/res.setHeader('Cache-Control', 'private, max-age=30, must-revalidate');/res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');/" src/app.ts &&
    sed -i "s/res.setHeader('Pragma', 'no-cache');/res.setHeader('Pragma', 'no-cache');/" src/app.ts || true
    """
    run_remote_cmd(client, disable_cache_cmd, "Disabling API Caching in app.ts")

    # 2. Rebuild and restart backend to apply source code change
    # Since we modified src/app.ts, we need to rebuild the dist
    rebuild_cmd = "cd /opt/qscrap && docker exec qscrap-backend npm run build && docker compose restart backend"
    run_remote_cmd(client, rebuild_cmd, "Rebuilding and Restarting Backend")

    client.close()
    print("\n--- Cache Fix Applied Successfully ---")
except Exception as e:
    print(f"❌ Connection failed: {e}")
