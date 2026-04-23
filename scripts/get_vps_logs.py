import os
import sys
import paramiko

def get_vps_logs():
    host = "147.93.89.153"
    password = os.getenv('VPS_PASS')
    
    if not password:
        print("❌ ERROR: VPS_PASS environment variable is missing!")
        sys.exit(1)

    print(f"🔍 Fetching Live Logs from VPS: {host}...")
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(host, username="root", password=password)
        
        # Command to get last 100 lines of backend logs
        stdin, stdout, stderr = ssh.exec_command("docker logs --tail 100 qscrap-backend")
        
        logs = stdout.read().decode('utf-8')
        errors = stderr.read().decode('utf-8')
        
        print("\n--- [ BACKEND LOGS START ] ---")
        print(logs)
        if errors:
            print("\n--- [ ERROR STREAM ] ---")
            print(errors)
        print("--- [ BACKEND LOGS END ] ---\n")
        
        ssh.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    get_vps_logs()
