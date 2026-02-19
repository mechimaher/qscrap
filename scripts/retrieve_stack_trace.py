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

    # 1. Search for "proof" to find the request ID of the failing request
    # 2. Search for "Error" or "Stack" around that time
    # We fetch a large window but filter server-side
    cmd = 'cd /opt/qscrap && docker compose logs backend --tail=5000 | grep -C 20 "proof"'
    run_cmd(client, cmd, "Logs surrounding /proof request")
    
    # 3. Also fetch general errors in the last 5000 lines
    cmd_err = 'cd /opt/qscrap && docker compose logs backend --tail=5000 | grep -E "(Error|Exception|Traceback)" -A 10 | tail -n 100'
    run_cmd(client, cmd_err, "Recent Stack Traces")

    client.close()
except Exception as e:
    print(f"Connection failed: {e}")
