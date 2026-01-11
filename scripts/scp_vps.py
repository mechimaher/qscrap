import pexpect
import sys
import os

def scp_file(host, user, password, local_path, remote_path):
    ssh_newkey = 'Are you sure you want to continue connecting'
    cmd = f'scp {local_path} {user}@{host}:{remote_path}'
    print(f"Running: {cmd}")
    child = pexpect.spawn(cmd)
    
    i = child.expect([ssh_newkey, 'password:', pexpect.EOF, pexpect.TIMEOUT])
    if i == 0:
        child.sendline('yes')
        i = child.expect([ssh_newkey, 'password:', pexpect.EOF, pexpect.TIMEOUT])
        
    if i == 1:
        child.sendline(password)
        child.expect(pexpect.EOF)
        return "Success"
    elif i == 2:
        return "Success"
    else:
        return "ERROR: Timeout or unexpected response"

if __name__ == "__main__":
    host = "147.93.89.153"
    user = "root"
    password = "***REDACTED***"
    
    if len(sys.argv) < 3:
        print("Usage: python3 scp_vps.py <local_path> <remote_path>")
        sys.exit(1)
        
    local_path = sys.argv[1]
    remote_path = sys.argv[2]
    
    result = scp_file(host, user, password, local_path, remote_path)
    print(result)
