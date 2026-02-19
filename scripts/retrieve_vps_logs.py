import paramiko
import os

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

def run_cmd(client, cmd, label):
    print(f"\n--- {label} ---")
    try:
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
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

    # 1. Backend Logs searching for errors/auth/404
    # grep -E "(API|token|authorization|404|401|403|error|exception|fail)" -i
    run_cmd(client, 'cd /root && docker compose logs backend --tail=1000 | grep -E "(API|token|authorization|404|401|403|error|exception|fail)" -i', "Backend Logs (Filtered)")

    # 2. Nginx Access Logs (Last 100 lines) - identifying 404s/403s
    run_cmd(client, 'tail -n 200 /var/log/nginx/access.log | grep -E "( 404 | 403 | 401 | 500 )"', "Nginx Access Logs (Errors)")

    # 3. Nginx Error Logs
    run_cmd(client, 'tail -n 100 /var/log/nginx/error.log', "Nginx Error Logs")
    
    client.close()
except Exception as e:
    print(f"Connection failed: {e}")
