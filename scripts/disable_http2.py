import os
import paramiko

host = "147.93.89.153"
user = "root"
password = os.environ.get("VPS_PASSWORD", "")

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Disable HTTP/2 in Nginx config (change "ssl http2" to just "ssl")
    print("🔧 Disabling HTTP/2 in Nginx...")
    stdin, stdout, stderr = client.exec_command("""
        sed -i 's/listen 443 ssl http2;/listen 443 ssl;/g' /etc/nginx/sites-enabled/qscrap &&
        sed -i 's/listen \\[::\\]:443 ssl http2;/listen [::]:443 ssl;/g' /etc/nginx/sites-enabled/qscrap
    """)
    stdout.read()
    
    # Verify change
    print("📝 New config:")
    stdin, stdout, stderr = client.exec_command("grep -E 'listen.*443' /etc/nginx/sites-enabled/qscrap")
    print(stdout.read().decode())
    
    # Reload Nginx
    print("🔄 Reloading Nginx...")
    stdin, stdout, stderr = client.exec_command("nginx -t && systemctl reload nginx")
    print(stderr.read().decode())
    
    print("✅ HTTP/2 disabled. Testing...")
    
    # Quick test
    stdin, stdout, stderr = client.exec_command("curl -s --connect-timeout 5 -o /dev/null -w 'HTTP: %{http_code}' https://qscrap.qa/")
    print(f"Local test: {stdout.read().decode()}")
    
    client.close()
    print("\n🔗 Please try: https://qscrap.qa/verify/QS-VRF-8DKE557K")
except Exception as e:
    print(f"Error: {e}")
