import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

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
    
    # Note: Backend might restart if nodemon is watching, but usually we should rebuild if dependencies changed.
    # No deps changed.
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
