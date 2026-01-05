import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Test HTTPS from the VPS itself
    print("=== Testing HTTPS from VPS ===")
    stdin, stdout, stderr = client.exec_command("curl -s --connect-timeout 5 -o /dev/null -w 'HTTP: %{http_code}, Time: %{time_total}s' https://qscrap.qa/admin-dashboard.html")
    print(stdout.read().decode())
    
    # Test HTTP
    print("\n=== Testing HTTP from VPS ===")
    stdin, stdout, stderr = client.exec_command("curl -s --connect-timeout 5 -o /dev/null -w 'HTTP: %{http_code}, Time: %{time_total}s' http://qscrap.qa/admin-dashboard.html")
    print(stdout.read().decode())
    
    # Test direct backend
    print("\n=== Testing Backend Directly ===")
    stdin, stdout, stderr = client.exec_command("curl -s --connect-timeout 5 -o /dev/null -w 'HTTP: %{http_code}, Time: %{time_total}s' http://localhost:3000/admin-dashboard.html")
    print(stdout.read().decode())
    
    # Test login
    print("\n=== Testing Login API ===")
    stdin, stdout, stderr = client.exec_command("curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{\"phone_number\":\"+97450000003\",\"password\":\"customer@1234\"}'")
    print(stdout.read().decode()[:200])
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
