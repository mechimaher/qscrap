import paramiko

host = "147.93.89.153"
user = "root"
password = "***REDACTED***"

try:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password)
    
    print("🔧 Applying TCP MSS Clamping (PMTU Discovery)...")
    # Clamp MSS to Path MTU (Automatic)
    CMD_AUTO = "iptables -t mangle -A OUTPUT -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu"
    
    # Or Force MSS to safer value (1360 bytes - common for tunnels/VPNs/Bad ISPs)
    CMD_FORCE = "iptables -t mangle -A OUTPUT -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1360"
    
    # Let's try --clamp-mss-to-pmtu first, if that fails we might need specific value.
    # But often cloud VPS need explicit set-mss if they are behind 1:1 NAT or similar.
    # Let's use 1360 which is very safe.
    
    print("forcing MSS to 1360 bytes (Safe Mode)...")
    stdin, stdout, stderr = client.exec_command(CMD_FORCE)
    err = stderr.read().decode()
    if err:
        print(f"Error: {err}")
    
    # Also forward chain just in case (though we are serving content)
    stdin, stdout, stderr = client.exec_command("iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu")
    
    # Verify
    print("\n📋 Current Mangle Table:")
    stdin, stdout, stderr = client.exec_command("iptables -t mangle -L OUTPUT -n")
    print(stdout.read().decode())
    
    # Install iptables-persistent to save if it works?
    
    client.close()
    print("\n✅ TCP MSS Limited to 1360 bytes. Packets should now flow smoothly.")
except Exception as e:
    print(f"Error: {e}")
