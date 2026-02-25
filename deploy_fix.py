import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("147.93.89.153", username="root", password="QScrap@2026byMaher")

def run(cmd):
    print(f"\n--- Running: {cmd} ---")
    stdin, stdout, stderr = client.exec_command(cmd)
    o = stdout.read().decode().strip()
    e = stderr.read().decode().strip()
    if o: print(o)
    if e: print("STDERR:", e)
    return stdin.channel.recv_exit_status()

# 1. Clean dead container
run("docker rm -f qscrap-backend")
# 2. Update code
run("cd /opt/qscrap && git fetch && git reset --hard origin/main")
# 3. Rebuild and up
run("cd /opt/qscrap && docker compose build backend")
run("cd /opt/qscrap && docker compose up -d")
# 4. Check status
run("docker ps --filter name=qscrap-backend")
run("docker logs --tail 20 qscrap-backend")

client.close()
