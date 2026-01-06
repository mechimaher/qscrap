import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔍 Inspecting Certificate...")
    stdin, stdout, stderr = client.exec_command("openssl x509 -in /etc/letsencrypt/live/qscrap.qa/fullchain.pem -text -noout | head -15")
    print(stdout.read().decode())
    
    print("🔧 Disabling OCSP Stapling (Optimization)...")
    # Stapling errors can cause connection hangs if browser waits for OCSP response that never comes
    CMD = """
    sed -i 's/ssl_stapling on;/ssl_stapling off;/g' /etc/nginx/sites-enabled/qscrap &&
    sed -i 's/ssl_stapling_verify on;/ssl_stapling_verify off;/g' /etc/nginx/sites-enabled/qscrap
    """
    stdin, stdout, stderr = client.exec_command(CMD)
    
    # Reload
    print("🔄 Reloading Nginx...")
    stdin, stdout, stderr = client.exec_command("nginx -t && systemctl reload nginx")
    err = stderr.read().decode()
    if 'ok' in err or 'successful' in err:
         print("✅ Nginx reloaded (Stapling OFF)")
    else:
         print(err)

    client.close()
except Exception as e:
    print(f"Error: {e}")
