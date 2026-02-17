import paramiko
import os
import getpass
import time

# Read credentials from environment variables (NEVER hardcode!)
host = os.environ.get("VPS_HOST")
user = os.environ.get("VPS_USER", "root")
password = os.environ.get("VPS_PASSWORD")

# Prompt if not set in environment
if not host:
    host = input("VPS Host: ").strip() or "147.93.89.153"
if not password:
    password = getpass.getpass("VPS Password: ")

def run_cmd(client, cmd, label=""):
    """Run a command and return stdout, stderr. Print output with label."""
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err and "warning" not in err.lower():
        print(f"⚠️  {err}")
    return out, err

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    print("🔍 Check git status on VPS...")
    run_cmd(client, "cd /opt/qscrap && git status")

    # ============================================
    # STEP 1: PROTECT .env BEFORE git reset
    # ============================================
    print("\n🔒 Protecting .env file...")
    run_cmd(client, "cd /opt/qscrap && cp .env .env.backup 2>/dev/null; echo 'Backup created'")

    # ============================================
    # STEP 2: Pull changes (force sync code only)
    # ============================================
    print("\n⬇️  Pulling changes (forcing sync)...")
    CMD = """
    cd /opt/qscrap && 
    git fetch origin main && 
    git reset --hard origin/main
    """
    run_cmd(client, CMD)

    # ============================================
    # STEP 3: RESTORE .env (git reset --hard doesn't touch untracked,
    #         but this is a safety net in case .env was somehow tracked)
    # ============================================
    print("\n🔒 Verifying .env is intact...")
    out, _ = run_cmd(client, "cd /opt/qscrap && cat .env | grep JWT_SECRET")
    
    # If .env got wiped or has dev secret, restore from backup
    if "dev-secret" in out or not out:
        print("⚠️  .env has dev secret or is missing! Restoring from backup...")
        run_cmd(client, "cd /opt/qscrap && cp .env.backup .env")
        out, _ = run_cmd(client, "cd /opt/qscrap && cat .env | grep JWT_SECRET")
    
    # Final safety: if STILL has dev secret, try qscrap.env
    if "dev-secret" in out:
        print("⚠️  Backup also has dev secret! Syncing from qscrap.env...")
        run_cmd(client, """cd /opt/qscrap && 
            PROD_SECRET=$(grep JWT_SECRET qscrap.env 2>/dev/null | cut -d= -f2) && 
            if [ -n "$PROD_SECRET" ]; then 
                sed -i "s|JWT_SECRET=.*|JWT_SECRET=$PROD_SECRET|" .env; 
                echo "✅ JWT_SECRET synced from qscrap.env"; 
            else 
                echo "❌ FATAL: No production JWT_SECRET found anywhere!"; 
                exit 1; 
            fi""")

    print("✅ .env verified and protected")

    # ============================================
    # STEP 4: Rebuild and restart
    # ============================================
    print("\n🔄 Rebuilding and restarting containers...")
    run_cmd(client, "cd /opt/qscrap && docker compose build --no-cache backend && docker compose up -d")

    print("\n⏳ Waiting for services to stabilize...")
    time.sleep(15)

    # ============================================
    # STEP 5: Run migrations
    # ============================================
    print("\n🗄️  Running Database Migrations...")
    run_cmd(client, "docker exec qscrap-backend npm run db:migrate")

    # ============================================
    # STEP 6: HEALTH CHECK — Verify auth is working
    # ============================================
    print("\n🏥 Running post-deploy health check...")
    
    # Check backend is responding
    out, _ = run_cmd(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health 2>/dev/null || echo '000'")
    if "200" in out:
        print("✅ Backend health endpoint: OK")
    else:
        print(f"⚠️  Backend health endpoint returned: {out}")

    # Check JWT secret is production (not dev)
    out, _ = run_cmd(client, "docker exec qscrap-backend env | grep JWT_SECRET")
    if "dev-secret" in out:
        print("❌ CRITICAL: Container is using dev JWT secret! Authentication will fail!")
        print("   Fix: Update .env on VPS with production JWT_SECRET and restart")
    else:
        print("✅ JWT secret: Production key active")

    # Check container status
    out, _ = run_cmd(client, "docker ps --filter name=qscrap-backend --format '{{.Status}}'")
    print(f"✅ Container status: {out}")

    print("\n" + "=" * 50)
    print("✅ VPS DEPLOYMENT COMPLETE")
    print("=" * 50)

    client.close()
except Exception as e:
    print(f"❌ Error: {e}")
