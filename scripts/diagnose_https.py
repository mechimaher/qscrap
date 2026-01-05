import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    # Check firewall rules
    print("=== UFW Status ===")
    stdin, stdout, stderr = client.exec_command("ufw status verbose 2>/dev/null || echo 'UFW not installed'")
    print(stdout.read().decode())
    
    # Check iptables
    print("=== IPTables (port 443) ===")
    stdin, stdout, stderr = client.exec_command("iptables -L -n 2>/dev/null | grep -E '443|https' | head -10 || echo 'No specific rules'")
    print(stdout.read().decode())
    
    # Check if there are connection issues
    print("=== Active Connections on 443 ===")
    stdin, stdout, stderr = client.exec_command("ss -tn state established '( sport = :443 )' | head -10")
    print(stdout.read().decode())
    
    # Check Nginx error log
    print("=== Nginx Error Log (last 10) ===")
    stdin, stdout, stderr = client.exec_command("tail -10 /var/log/nginx/error.log 2>/dev/null || echo 'No error log'")
    print(stdout.read().decode())
    
    # Try forcing HTTP/1.1 in Nginx config
    print("=== Current Nginx listening config ===")
    stdin, stdout, stderr = client.exec_command("grep -E 'listen.*443' /etc/nginx/sites-enabled/qscrap")
    print(stdout.read().decode())
    
    client.close()
except Exception as e:
    print(f"Error: {e}")
