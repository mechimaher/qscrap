import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

# Define allowed origins for web dashboards
allowed_origins = "http://147.93.89.153:3000,http://qscrap.qa:3000,https://qscrap.qa,http://localhost:3000"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Check if ALLOWED_ORIGINS already in .env
    stdin, stdout, stderr = client.exec_command("grep -q 'ALLOWED_ORIGINS=' /opt/qscrap/.env && echo 'exists' || echo 'missing'")
    result = stdout.read().decode().strip()
    
    if result == 'missing':
        stdin, stdout, stderr = client.exec_command(f"echo 'ALLOWED_ORIGINS={allowed_origins}' >> /opt/qscrap/.env")
        print(f"✅ Added ALLOWED_ORIGINS to .env")
    else:
        # Update existing
        stdin, stdout, stderr = client.exec_command(f"sed -i 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS={allowed_origins}|' /opt/qscrap/.env")
        print(f"✅ Updated ALLOWED_ORIGINS in .env")
    
    # Restart backend to pick up new env
    print("🔄 Restarting backend...")
    stdin, stdout, stderr = client.exec_command("cd /opt/qscrap && docker compose restart backend")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    print("✅ Done! Web dashboards should now work.")
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
