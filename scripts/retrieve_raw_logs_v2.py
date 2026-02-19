import paramiko
import os

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

def run_cmd(client, cmd, label):
    print(f"\n--- {label} ---")
    try:
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode(errors='replace').strip()
        err = stderr.read().decode(errors='replace').strip()
        if out:
            print(out)
        if err:
            print(f"STDERR: {err}")
    except Exception as e:
        print(f"Failed: {e}")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    # 1. Try finding where docker-compose.yml is
    run_cmd(client, 'find /root /opt -name "docker-compose.yml" 2>/dev/null', "Locating docker-compose.yml")

    # 2. Try fetching logs from /opt/qscrap
    run_cmd(client, 'cd /opt/qscrap && docker compose logs backend --tail=1000', "Backend Logs (from /opt/qscrap)")
    
    # 3. Fallback: Try fetching logs from /root/qscrap (just in case)
    run_cmd(client, 'cd /root/qscrap && docker compose logs backend --tail=1000', "Backend Logs (from /root/qscrap)")

    # 4. Fallback: Try fetching logs from /root
    run_cmd(client, 'cd /root && docker compose logs backend --tail=1000', "Backend Logs (from /root)")

    client.close()
except Exception as e:
    print(f"Connection failed: {e}")
