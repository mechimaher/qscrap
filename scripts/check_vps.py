import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("147.93.89.153", username="root", password="QScrap@2026byMaher")

def cmd(c):
    print(f"Running: {c}")
    i,o,e = client.exec_command(c)
    print(o.read().decode().strip())
    print(e.read().decode().strip())

cmd("docker ps -a --filter name=qscrap-backend")
cmd("cat /opt/qscrap/.git/HEAD")
client.close()
