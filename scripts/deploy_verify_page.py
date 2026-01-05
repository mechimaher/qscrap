import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    sftp = client.open_sftp()
    
    print("📤 Uploading verify.html...")
    sftp.put(
        "/home/user/qscrap.qa/public/verify.html",
        "/opt/qscrap/public/verify.html"
    )
    print("✅ verify.html uploaded!")
    
    print("📤 Uploading app.ts...")
    sftp.put(
        "/home/user/qscrap.qa/src/app.ts",
        "/opt/qscrap/src/app.ts"
    )
    print("✅ app.ts uploaded!")
    
    sftp.close()
    
    # Wait for nodemon to restart
    import time
    print("\n🔄 Waiting for nodemon to restart...")
    time.sleep(3)
    
    # Check backend logs
    stdin, stdout, stderr = client.exec_command("docker logs qscrap-backend --tail=8 2>&1")
    print(stdout.read().decode())
    
    print("✅ Verification page deployed!")
    print("🔗 Test at: https://qscrap.qa/verify/TEST123")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
