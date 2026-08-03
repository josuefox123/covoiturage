import paramiko
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOSTNAME = "node239-eu.n0c.com"
PORT = 5022
USERNAME = "ewnhmjym"
PASSWORD = "H6aYpcsK9NEzAm"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(HOSTNAME, port=PORT, username=USERNAME, password=PASSWORD)
    print("SSH OK")

    # Kill both bash wrapper and python process
    print("Killing existing Daphne processes...")
    client.exec_command("pkill -9 -f daphne || true")
    client.exec_command("kill -9 2686130 2686131 || true")
    
    import time
    time.sleep(2)
    
    # Start backend
    print("Starting Daphne backend...")
    stdin, stdout, stderr = client.exec_command("cd /home/ewnhmjym/zemy && ./start_backend.sh")
    print(stdout.read().decode('utf-8', errors='replace'))
    print(stderr.read().decode('utf-8', errors='replace'))
    
    time.sleep(2)
    print("Verifying if port 8014 is open:")
    stdin_ps, stdout_ps, stderr_ps = client.exec_command("ps -u ewnhmjym -f | grep daphne")
    print(stdout_ps.read().decode('utf-8', errors='replace'))

except Exception as e:
    print(f"Erreur: {e}")
finally:
    client.close()
