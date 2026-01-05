import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Upload the fixed documents.routes.ts
    sftp = client.open_sftp()
    
    print("📤 Uploading fixed documents.routes.ts...")
    sftp.put(
        "/home/user/qscrap.qa/src/routes/documents.routes.ts",
        "/opt/qscrap/src/routes/documents.routes.ts"
    )
    print("✅ Uploaded!")
    
    sftp.close()
    
    # Nodemon should auto-restart, but let's verify
    print("\n🔄 Checking backend status (nodemon should auto-reload)...")
    stdin, stdout, stderr = client.exec_command("docker logs qscrap-backend --tail=5 2>&1")
    print(stdout.read().decode())
    
    print("✅ Documents route fix deployed!")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
