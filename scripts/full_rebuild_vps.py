import paramiko
import os
import time

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
    if err and "warning" not in err.lower():
        print(f"OUTPUT: {err}")
    return out

def upload_file(scp, local_path, remote_path):
    print(f"⬆️  Uploading {local_path} to {remote_path}...")
    try:
        scp.put(local_path, remote_path)
    except Exception as e:
        print(f"❌ Failed to upload {local_path}: {e}")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    scp = client.open_sftp()

    print(f"✅ Connected to VPS: {host}")

    # 1. Sync from GitHub
    sync_cmd = """
    cd /opt/qscrap && 
    git fetch origin main && 
    git reset --hard origin/main
    """
    run_remote_cmd(client, sync_cmd, "Syncing from GitHub (origin/main)")

    # 2. Fix Stripe API Version across all files (to prevent build failure)
    print("\n🩹 Patching Stripe API Version in source...")
    patch_stripe_cmd = "cd /opt/qscrap && grep -r '2025-12-15.clover' src/ -l | xargs -r sed -i 's/2025-12-15.clover/2026-02-25.clover/g'"
    run_remote_cmd(client, patch_stripe_cmd, "Patching Stripe version on VPS")

    # 3. Upload local modified files
    upload_file(scp, "src/app.ts", "/opt/qscrap/src/app.ts")
    upload_file(scp, "src/services/address/address.service.ts", "/opt/qscrap/src/services/address/address.service.ts")
    upload_file(scp, "src/services/dashboard/dashboard.service.ts", "/opt/qscrap/src/services/dashboard/dashboard.service.ts")
    upload_file(scp, "scripts/fix_production_db.js", "/opt/qscrap/scripts/fix_production_db.js")
    upload_file(scp, "scripts/test_smtp.js", "/opt/qscrap/scripts/test_smtp.js")

    # 4. Rebuild and Restart
    print("\n🔄 Starting Full Rebuild (this may take 1-2 minutes)...")
    rebuild_cmd = "cd /opt/qscrap && docker compose build --no-cache backend && docker compose up -d"
    run_remote_cmd(client, rebuild_cmd, "Rebuilding Backend Image")

    print("⏳ Waiting for services to stabilize (15s)...")
    time.sleep(15)

    # 5. DB Patching (Now that the image is built with the script)
    run_remote_cmd(client, "docker exec qscrap-backend npm run db:migrate", "Running Migrations")
    run_remote_cmd(client, "docker exec qscrap-backend node scripts/fix_production_db.js", "Applying Production DB Patches")

    # 6. Final Health Check
    health_status = run_remote_cmd(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo '000'", "Backend Health Check")
    if "200" in health_status:
        print("\n✅ REBUILD SUCCESSFUL: Backend is online and healthy!")
    else:
        print(f"\n⚠️  REBUILD WARNING: Health check returned {health_status}")

    scp.close()
    client.close()
except Exception as e:
    print(f"❌ Rebuild failed: {e}")
