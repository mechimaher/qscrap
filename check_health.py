import paramiko
import time

hostname = '147.93.89.153'
username = 'root'
password = '***REDACTED***'

def run_command(ssh, command):
    stdin, stdout, stderr = ssh.exec_command(command)
    out = stdout.read().decode().strip()
    return out

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, username=username, password=password)

    print("Checking health...")
    for i in range(6):
        out = run_command(client, 'curl -s http://localhost:3000/health')
        if "success" in out:
            print(f"Health Check Passed: {out}")
            break
        print(f"Attempt {i+1}: Failed, retrying...")
        time.sleep(5)
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
