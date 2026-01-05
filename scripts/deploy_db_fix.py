import paramiko
import os

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

files_to_deploy = [
    ("src/config/db.ts", "/opt/qscrap/src/config/db.ts"),
    ("src/middleware/csrf.middleware.ts", "/opt/qscrap/src/middleware/csrf.middleware.ts"),
]

env_addition = "\nDB_SSL=false\n"

try:
    print(f"🚀 Deploying database SSL fix to {host}...")
    transport = paramiko.Transport((host, 22))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    
    # Deploy files
    for local_path, remote_path in files_to_deploy:
        print(f"  📄 Uploading {local_path}")
        sftp.put(local_path, remote_path)
    
    sftp.close()
    transport.close()
    
    # Now add DB_SSL=false to .env via SSH
    print("🔧 Updating .env with DB_SSL=false...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Check if DB_SSL already in .env
    stdin, stdout, stderr = client.exec_command("grep -q 'DB_SSL=' /opt/qscrap/.env && echo 'exists' || echo 'missing'")
    result = stdout.read().decode().strip()
    
    if result == 'missing':
        stdin, stdout, stderr = client.exec_command("echo 'DB_SSL=false' >> /opt/qscrap/.env")
        print("  ✅ Added DB_SSL=false to .env")
    else:
        # Update existing
        stdin, stdout, stderr = client.exec_command("sed -i 's/DB_SSL=.*/DB_SSL=false/' /opt/qscrap/.env")
        print("  ✅ Updated DB_SSL=false in .env")
    
    client.close()
    print("✅ Deployment complete! Backend will auto-reload via nodemon.")
    
except Exception as e:
    print(f"❌ Error: {e}")
