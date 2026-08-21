import os
import paramiko

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

inspect_script = """
import sys
sys.path.append('/home/ewnhmjym/zemy/backend')
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Booking
print(f"Total bookings: {Booking.objects.count()}")
for b in Booking.objects.all():
    print(f"ID: {b.id} | Status: {b.status} | Payment: {b.payment_status} | Total Amount: {b.total_amount} | Passenger: {b.passenger.phone} | Driver: {b.ride.driver.phone}")


"""

remote_path = "/home/ewnhmjym/zemy/backend/inspect_db.py"
sftp = client.open_sftp()
with sftp.file(remote_path, 'w') as f:
    f.write(inspect_script)
sftp.close()

_, stdout, stderr = client.exec_command("cd /home/ewnhmjym/zemy/backend && ./venv/bin/python3 inspect_db.py")
print("STDOUT:")
print(stdout.read().decode('utf-8'))
print("STDERR:")
print(stderr.read().decode('utf-8'))

client.exec_command(f"rm -f {remote_path}")
client.close()
