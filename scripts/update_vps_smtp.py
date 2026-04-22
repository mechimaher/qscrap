import paramiko
import os

# --- VPS CONFIGURATION ---
host = "147.93.89.153"
user = "root"
password = os.getenv("VPS_PASS") # Securely loaded

if not password:
    print("❌ ERROR: VPS_PASS environment variable is missing!")
    exit(1)

# --- CONFIGURATION (Use environment variables for security) ---
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "qscrap.noreply@gmail.com"
SMTP_PASS = os.getenv("SMTP_PASS") 
SMTP_FROM = f"QScrap <{SMTP_USER}>"

if not SMTP_PASS:
    print("❌ ERROR: SMTP_PASS environment variable is missing!")
    print("Usage: SMTP_PASS=your_app_password python3 scripts/update_vps_smtp.py")
    exit(1)

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

    # 1. Update .env file on VPS
    # We use sed to replace the SMTP lines or append if they don't exist
    update_env_cmd = f"""
    cd /opt/qscrap && 
    sed -i 's|^SMTP_HOST=.*|SMTP_HOST={SMTP_HOST}|' .env || echo "SMTP_HOST={SMTP_HOST}" >> .env &&
    sed -i 's|^SMTP_PORT=.*|SMTP_PORT={SMTP_PORT}|' .env || echo "SMTP_PORT={SMTP_PORT}" >> .env &&
    sed -i 's|^SMTP_USER=.*|SMTP_USER={SMTP_USER}|' .env || echo "SMTP_USER={SMTP_USER}" >> .env &&
    sed -i 's|^SMTP_PASS=.*|SMTP_PASS={SMTP_PASS}|' .env || echo "SMTP_PASS={SMTP_PASS}" >> .env &&
    sed -i 's|^SMTP_SECURE=.*|SMTP_SECURE=false|' .env || echo "SMTP_SECURE=false" >> .env &&
    sed -i 's|^SMTP_FROM=.*|SMTP_FROM={SMTP_USER}|' .env || echo "SMTP_FROM={SMTP_USER}" >> .env
    """
    run_remote_cmd(client, update_env_cmd, "Updating .env with Brevo SMTP")

    # 2. Restart backend container
    run_remote_cmd(client, "cd /opt/qscrap && docker compose up -d backend", "Restarting Backend Container")

    # 3. Verify with SMTP Diagnostic (streaming local script)
    print("\n--- Running Final SMTP Verification ---")
    local_test_script = "scripts/test_smtp.js"
    if os.path.exists(local_test_script):
        with open(local_test_script, 'r') as f:
            script_content = f.read()
        escaped_content = script_content.replace("'", "'\\''")
        verify_cmd = f"echo '{escaped_content}' | docker exec -i qscrap-backend node -"
        stdin, stdout, stderr = client.exec_command(verify_cmd)
        print(stdout.read().decode().strip())
        print(stderr.read().decode().strip())

    client.close()
    print("\n--- SMTP Update Finished ---")
except Exception as e:
    print(f"❌ Connection failed: {e}")
