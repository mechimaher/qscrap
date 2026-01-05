import paramiko
import os

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"
remote_path = "/opt/qscrap/src/middleware/csrf.middleware.ts"
local_path = "src/middleware/csrf.middleware.ts"

try:
    print(f"🚀 Deploying hotfix to {host}...")
    transport = paramiko.Transport((host, 22))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    
    print(f"Uploading {local_path} -> {remote_path}")
    sftp.put(local_path, remote_path)
    
    sftp.close()
    transport.close()
    print("✅ Hotfix deployed successfully!")
except Exception as e:
    print(f"❌ Error: {e}")
