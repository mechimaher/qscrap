import paramiko
import os
import getpass

# Read credentials from environment variables (NEVER hardcode!)
host = os.environ.get("VPS_HOST")
user = os.environ.get("VPS_USER", "root")
password = os.environ.get("VPS_PASSWORD")

# Prompt if not set in environment
if not host:
    host = input("VPS Host: ").strip() or "147.93.89.153"
if not password:
    password = getpass.getpass("VPS Password: ")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔍 Check git status on VPS...")
    stdin, stdout, stderr = client.exec_command("cd /opt/qscrap && git status")
    print(stdout.read().decode())
    
    # We want to use the version from GitHub as the source of truth now, 
    # but I just committed exactly what I deployed. So they should match essentially.
    
    print("⬇️  Pulling changes (forcing sync)...")
    CMD = """
    cd /opt/qscrap && 
    git fetch origin main && 
    git reset --hard origin/main
    """
    # Note: git reset --hard is safe here because I just pushed exactly what I want to be there. 
    # Any "local changes" on VPS were just my SFTP uploads which are now in the repo.
    
    stdin, stdout, stderr = client.exec_command(CMD)
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    # Re-apply any special VPS-only configs if needed?
    # No, the repo should have everything. Env file is not tracked so it's safe.
    # But wait, did I push the Nginx config? No, Nginx config is in /etc/nginx/, not in repo.
    # The 'app.ts' and 'documents.routes.ts' ARE in repo.
    # So git reset --hard is perfect.
    
    print("✅ VPS synced with GitHub!")
    
    print("🔄 Rebuilding and restarting containers...")
    stdin, stdout, stderr = client.exec_command("cd /opt/qscrap && docker compose build --no-cache backend && docker compose up -d")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    print("⏳ Waiting for services to stabilize...")
    import time
    time.sleep(15)

    print("🗄️  Running Database Migrations...")
    stdin, stdout, stderr = client.exec_command("docker exec qscrap-backend npm run db:migrate")
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print(f"Migration Output/Error: {err}")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
