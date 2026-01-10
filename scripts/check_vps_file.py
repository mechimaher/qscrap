
import paramiko
import os

# VPS Details
VPS_IP = "147.93.89.153"
VPS_USER = "root"
VPS_PASS = "QScrap@2026byMaher"

def check_file():
    print(f"🔌 Connecting to {VPS_IP}...")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(hostname=VPS_IP, username=VPS_USER, password=VPS_PASS)
        
        print("🔍 Checking content of garage-dashboard.js on VPS...")
        # Check for the key fix strings
        cmd = "grep -n 'subscriptions/change-plan' /opt/qscrap/public/js/garage-dashboard.js && grep -n 'Array.isArray(data)' /opt/qscrap/public/js/garage-dashboard.js"
        stdin, stdout, stderr = client.exec_command(cmd)
        
        output = stdout.read().decode()
        error = stderr.read().decode()
        
        if output:
            print("✅ Found expected changes:")
            print(output)
        else:
            print("❌ Changes NOT found. File content might be old.")
            print("STDERR:", error)
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    check_file()
