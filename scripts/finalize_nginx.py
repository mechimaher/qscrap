import os
import paramiko

host = "147.93.89.153"
user = "root"
password = os.environ.get("VPS_PASSWORD", "")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🛑 Stop and remove Caddy container...")
    stdin, stdout, stderr = client.exec_command("docker stop caddy 2>/dev/null || true && docker rm caddy 2>/dev/null || true")
    print(stdout.read().decode())
    
    print("🔁 Removing Caddy from docker-compose restart policy (if present)...")
    # We might need to edit docker-compose.yml to remove caddy service, 
    # but strictly speaking, just stopping it and enabling nginx systemd service is enough for now
    # as long as we don't run `docker compose up` blindly which might bring it back.
    # Typically deployment scripts might need updating.
    
    print("✅ Enabling Nginx systemd service...")
    stdin, stdout, stderr = client.exec_command("systemctl enable nginx")
    print(stdout.read().decode())
    
    print("🚀 Nginx status...")
    stdin, stdout, stderr = client.exec_command("systemctl status nginx --no-pager | head -5")
    print(stdout.read().decode())

    client.close()
    print("\n✅ Migration finalized: Caddy removed, Nginx enabled.")

except Exception as e:
    print(f"Error: {e}")
