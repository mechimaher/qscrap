import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Test HTTPS from VPS
    print("=== Testing HTTPS from VPS ===")
    stdin, stdout, stderr = client.exec_command("curl -s --connect-timeout 5 -o /dev/null -w 'HTTP: %{http_code}, Time: %{time_total}s' https://qscrap.qa/verify/QS-VRF-8DKE557K")
    print(stdout.read().decode())
    
    # Test HTTP redirect
    print("\n=== Testing HTTP Redirect ===")
    stdin, stdout, stderr = client.exec_command("curl -s --connect-timeout 5 -o /dev/null -w 'HTTP: %{http_code}' http://qscrap.qa/")
    print(stdout.read().decode())
    
    # Check Nginx status
    print("\n=== Nginx Status ===")
    stdin, stdout, stderr = client.exec_command("systemctl is-active nginx && netstat -tlnp | grep -E ':80|:443'")
    print(stdout.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
