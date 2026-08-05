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

files_to_upload = [
    ("backend/api/views/chat.py", "/home/ewnhmjym/zemy/backend/api/views/chat.py"),
    ("backend/api/views/settings.py", "/home/ewnhmjym/zemy/backend/api/views/settings.py"),
    ("backend/api/websocket/consumers.py", "/home/ewnhmjym/zemy/backend/api/websocket/consumers.py"),
    ("backend/api/utilisateurs/views/profil.py", "/home/ewnhmjym/zemy/backend/api/utilisateurs/views/profil.py"),
    ("backend/api/payments/services.py", "/home/ewnhmjym/zemy/backend/api/payments/services.py"),
    ("backend/api/services/booking_service.py", "/home/ewnhmjym/zemy/backend/api/services/booking_service.py"),
    ("backend/api/reservations/views/bookings.py", "/home/ewnhmjym/zemy/backend/api/reservations/views/bookings.py"),
    ("backend/api/management/commands/check_pending_payments.py", "/home/ewnhmjym/zemy/backend/api/management/commands/check_pending_payments.py"),
    ("backend/api/paiements/views/checkout.py", "/home/ewnhmjym/zemy/backend/api/paiements/views/checkout.py"),
    ("backend/api/paiements/views/earnings.py", "/home/ewnhmjym/zemy/backend/api/paiements/views/earnings.py"),
    ("backend/config/settings.py", "/home/ewnhmjym/zemy/backend/config/settings.py"),
]

print("=== UPLOADING FILES VIA SFTP ===")
sftp = client.open_sftp()
for local, remote in files_to_upload:
    local_path = os.path.join(os.path.dirname(__file__), "..", local)
    sftp.put(local_path, remote)
    print(f"Uploaded: {local} -> {remote}")
sftp.close()
print("All files uploaded successfully!")

print("=== KILL OLD DAPHNE PROCESSES ===")
client.exec_command("killall -9 daphne 2>/dev/null; pkill -9 -f 'daphne' 2>/dev/null")
time.sleep(3)

print("=== START FRESH DAPHNE ===")
client.exec_command("nohup /home/ewnhmjym/zemy/start_backend.sh > /home/ewnhmjym/zemy/logs/backend.log 2>&1 &")
time.sleep(3)

print("=== CHECK DAPHNE PROCESSES ===")
_, stdout, _ = client.exec_command("ps aux | grep daphne")
print(stdout.read().decode('utf-8'))

client.close()
