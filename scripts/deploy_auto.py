import pexpect
import sys
import os
import time
from datetime import datetime

# Configuration
VPS_IP = "147.93.89.153"
VPS_USER = "root"
VPS_PASS = "QScrap@2026byMaher"
REPO_URL = "https://github.com/mechimaher/qscrap.git"
PROJECT_DIR = "/opt/qscrap"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def main():
    log(f"🚀 Starting QScrap Git Deployment to {VPS_IP}")

    # Remote Execution Script
    remote_script = f"""
set -e

# 1. Install Docker & Git if needed
echo '[1/4] Checking System Dependencies...'
apt-get update -qq >/dev/null
if ! command -v docker &> /dev/null; then
    echo 'Installing Docker...'
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh >/dev/null
fi
if ! command -v git &> /dev/null; then
    echo 'Installing Git...'
    apt-get install -y git >/dev/null
fi

# 2. Setup Project Directory
echo '[2/4] Syncing Code...'
if [ -d "{PROJECT_DIR}/.git" ]; then
    echo "Updating existing repository..."
    cd {PROJECT_DIR}
    git reset --hard
    git pull origin main
else
    echo "Cloning fresh repository..."
    rm -rf {PROJECT_DIR}
    git clone {REPO_URL} {PROJECT_DIR}
    cd {PROJECT_DIR}
fi

# 3. Setup Env (Preserve existing or create new)
echo '[3/4] Configuring Environment...'
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD={VPS_PASS}
DB_NAME=qscrap_db
JWT_SECRET=QScrap_JWT_SECURE_KEY_$(date +%s)
DB_POOL_MAX=20
EOF
fi

# 4. Launch
echo '[4/4] Launching Containers...'
docker compose down --remove-orphans || true
docker compose up -d --build

# 5. Migrate
echo '[5/5] Running Database Migrations...'
sleep 15 # Wait for DB and Backend to be fully ready
docker exec qscrap-backend npm run db:migrate

echo '✅ Deployment SUCCESS! Visit http://{VPS_IP}'
"""
    
    log("Connecting to VPS...")
    ssh_cmd = f"ssh -o StrictHostKeyChecking=no {VPS_USER}@{VPS_IP} 'bash -s'"
    
    child = pexpect.spawn(ssh_cmd)
    i = child.expect(['password:', 'continue connecting (yes/no/[fingerprint])?'], timeout=30)
    if i == 1:
        child.sendline('yes')
        child.expect('password:', timeout=30)
    child.sendline(VPS_PASS)
    
    # Send the script
    child.sendline(remote_script)
    # Send EOF to indicate end of script input
    child.sendeof() 
    
    # Read output
    while True:
        try:
            line = child.readline()
            if not line:
                break
            print(line.decode('utf-8', errors='replace').strip())
        except pexpect.EOF:
            break
    
    child.close()

if __name__ == "__main__":
    main()
