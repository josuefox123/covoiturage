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

print("=== FINANCIAL SETTINGS ===")
from api.models import FinancialSettings
for s in FinancialSettings.objects.all():
    print(s.id, s.commission_percentage, s.min_commission, s.max_commission, s.is_commission_active)

b = Booking.objects.get(id="05198db1-1c23-45c9-b221-1e6dff8fb138")
from api.services.pricing_service import PricingService
pricing = PricingService.compute_for_booking(b)
print(f"custom_price: {b.custom_price}")
print(f"passenger_proposed_price: {b.passenger_proposed_price}")
print(f"driver_counter_price: {b.driver_counter_price}")
print(f"total_amount: {b.total_amount}")
print(f"amount_paid_online: {b.amount_paid_online}")
print(f"seats_booked: {b.seats_booked}")
print(f"pickup_location_extra: {getattr(b, 'pickup_location_extra', None)}")
print(f"pickup_surcharge: {getattr(b, 'pickup_surcharge', None)}")
print(f"dropoff_location_extra: {getattr(b, 'dropoff_location_extra', None)}")
print(f"dropoff_surcharge: {getattr(b, 'dropoff_surcharge', None)}")
print(f"pricing.driver_price: {pricing.driver_price}")
print(f"pricing.commission: {pricing.commission}")
print(f"pricing.driver_amount: {pricing.driver_amount}")
print(f"pricing.zemy_amount: {pricing.zemy_amount}")
print(f"pricing.total_to_pay: {pricing.total_to_pay}")

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
