import paramiko
import os

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

def run_cmd(client, cmd, label):
    print(f"\n--- {label} ---")
    try:
        stdin, stdout, stderr = client.exec_command(cmd)
        # Read a larger chunk, but safeguard against huge dumps
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

    # Fetch last 2000 lines of backend logs to catch the 500 stack trace
    run_cmd(client, 'cd /root && docker compose logs backend --tail=2000', "Backend Raw Logs")
    
    client.close()
except Exception as e:
    print(f"Connection failed: {e}")
