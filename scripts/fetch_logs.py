
import paramiko
import os

# VPS Details
VPS_IP = "147.93.89.153"
VPS_USER = "root"
VPS_PASS = "***REDACTED***"

def fetch_logs():
    print(f"🔌 Connecting to {VPS_IP}...")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(hostname=VPS_IP, username=VPS_USER, password=VPS_PASS)
        
        print("🔍 Fetching container logs...")
        # Get logs from both qscrap-backend and verify if it's restarting
        stdin, stdout, stderr = client.exec_command("docker logs --tail 100 qscrap-backend")
        
        logs = stdout.read().decode()
        error_logs = stderr.read().decode()
        
        print("\n=== STDOUT ===")
        print(logs)
        print("\n=== STDERR ===")
        print(error_logs)
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    fetch_logs()
