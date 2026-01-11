import pexpect
import sys

def run_ssh_command(host, user, password, command):
    ssh_newkey = 'Are you sure you want to continue connecting'
    child = pexpect.spawn(f'ssh {user}@{host} "{command}"')
    
    i = child.expect([ssh_newkey, 'password:', pexpect.EOF, pexpect.TIMEOUT])
    if i == 0:
        child.sendline('yes')
        i = child.expect([ssh_newkey, 'password:', pexpect.EOF, pexpect.TIMEOUT])
        
    if i == 1:
        child.sendline(password)
        child.expect(pexpect.EOF)
        return child.before.decode()
    elif i == 2:
        return child.before.decode()
    else:
        return "ERROR: Timeout or unexpected response"

if __name__ == "__main__":
    host = "147.93.89.153"
    user = "root"
    password = "***REDACTED***"
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
    else:
        # Default command
        cmd = "docker logs qscrap-backend --tail 100"
    
    print(f"Running command on VPS: {cmd}")
    output = run_ssh_command(host, user, password, cmd)
    print(output)
