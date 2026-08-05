import os
import paramiko
import time

def load_secrets():
    secrets = {}
    env_path = os.path.join(os.path.dirname(__file__), "..", "deploy_secrets.env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        secrets[parts[0].strip()] = parts[1].strip()
    return secrets

secrets = load_secrets()
HOSTNAME = secrets.get("DEPLOY_HOSTNAME", "node239-eu.n0c.com")
PORT = int(secrets.get("DEPLOY_PORT", 5022))
USERNAME = secrets.get("DEPLOY_USERNAME", "ewnhmjym")
PASSWORD = secrets.get("DEPLOY_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOSTNAME, port=PORT, username=USERNAME, password=PASSWORD, timeout=30)

local_file = os.path.join(os.path.dirname(__file__), "..", "backend", "api", "reservations", "views", "bookings.py")
remote_file = "/home/ewnhmjym/zemy/backend/api/reservations/views/bookings.py"

print("=== UPLOADING bookings.py VIA SFTP ===")
sftp = client.open_sftp()
sftp.put(local_file, remote_file)
sftp.close()
print("Uploaded successfully!")

print("=== KILL OLD DAPHNE PROCESSES ===")
client.exec_command("killall -9 daphne 2>/dev/null; pkill -9 -f 'daphne' 2>/dev/null")
time.sleep(3)

print("=== START FRESH DAPHNE ===")
client.exec_command("nohup /home/ewnhmjym/zemy/start_backend.sh > /home/ewnhmjym/zemy/logs/backend.log 2>&1 &")
time.sleep(3)

print("=== CHECK DAPHNE PROCESSES ===")
_, stdout, _ = client.exec_command("ps aux | grep daphne")
print(stdout.read().decode('utf-8'))

print("=== CHECK RECENT DAPHNE LOG ===")
_, stdout, _ = client.exec_command("tail -n 20 /home/ewnhmjym/zemy/logs/backend.log")
print(stdout.read().decode('utf-8'))

client.close()
