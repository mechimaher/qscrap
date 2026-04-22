import paramiko

# VPS Credentials
host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

def run_remote_cmd(client, cmd, label):
    print(f"\n--- {label} ---")
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode().strip())
    print(stderr.read().decode().strip())

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)

    run_remote_cmd(client, "docker exec qscrap-backend find dist -name app.js", "Finding Compiled app.js")

    client.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
