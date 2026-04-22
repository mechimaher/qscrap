import paramiko
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
    if err:
        print(f"OUTPUT: {err}")
    return out

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    print(f"✅ Connected to VPS: {host}")

    # 1. Stop all containers
    run_remote_cmd(client, "cd /opt/qscrap && docker compose down", "Stopping Full Stack")

    # 2. Start Dependencies (Database & Redis)
    run_remote_cmd(client, "cd /opt/qscrap && docker compose up -d postgres redis", "Starting Database & Redis")
    
    print("⏳ Waiting for database to stabilize (10s)...")
    time.sleep(10)

    # 3. Start Backend
    run_remote_cmd(client, "cd /opt/qscrap && docker compose up -d backend", "Starting Backend Container")
    
    print("⏳ Waiting for backend to initialize (15s)...")
    time.sleep(15)

    # 4. Run Migrations (Safety check)
    run_remote_cmd(client, "docker exec qscrap-backend npm run db:migrate", "Ensuring Migrations are Up-to-Date")

    # 5. Health Check
    print("\n--- Final Health Check ---")
    run_remote_cmd(client, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'", "Container Status")
    
    health = run_remote_cmd(client, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo '000'", "Backend API Health")
    if "200" in health:
        print("✅ Backend is responding successfully on port 3000")
    else:
        print(f"⚠️  Backend health check returned status: {health}")

    client.close()
    print("\n--- Full Backend Restart Complete ---")
except Exception as e:
    print(f"❌ Connection failed: {e}")
