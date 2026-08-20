#!/usr/bin/env python3
import os, sys, paramiko

def load_secrets():
    secrets = {}
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deploy_secrets.env")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                secrets[k.strip()] = v.strip()
    return secrets

secrets = load_secrets()
HOSTNAME = secrets.get("DEPLOY_HOSTNAME", "node239-eu.n0c.com")
PORT     = int(secrets.get("DEPLOY_PORT", 5022))
USERNAME = secrets.get("DEPLOY_USERNAME", "ewnhmjym")
PASSWORD = secrets.get("DEPLOY_PASSWORD", "")
REMOTE   = f"/home/{USERNAME}/zemy/backend"

CLEANUP = """
import sys
sys.path.insert(0, '/home/ewnhmjym/zemy/backend')
import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()
from api.models import (Ride, RideLeg, RideWaypoint, RideSeries, DirectionsCache, SearchAlert, Booking, Payment, Transaction, RefundRequest, DriverPayout, Conversation, Message, ModerationLog, Notification, Parcel, SupportTicket, AuditLog, Promotion)
steps = [('DriverPayout',DriverPayout),('RefundRequest',RefundRequest),('Transaction',Transaction),('Payment',Payment),('Booking',Booking),('ModerationLog',ModerationLog),('Message',Message),('Conversation',Conversation),('Notification',Notification),('Parcel',Parcel),('SupportTicket',SupportTicket),('AuditLog',AuditLog),('Promotion',Promotion),('RideWaypoint',RideWaypoint),('RideLeg',RideLeg),('DirectionsCache',DirectionsCache),('SearchAlert',SearchAlert),('Ride',Ride),('RideSeries',RideSeries)]
for name, model in steps:
    count = model.objects.count()
    model.objects.all().delete()
    print(f'  [OK] {name}: {count} supprime(s)')
from api.models import User, Vehicle
print(f'Users conserves: {User.objects.count()} | Vehicles: {Vehicle.objects.count()}')
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connexion SSH {HOSTNAME}:{PORT}...")
client.connect(HOSTNAME, port=PORT, username=USERNAME, password=PASSWORD, timeout=30)
print("OK")

remote_script = f"/home/{USERNAME}/zemy/_db_cleanup.py"
sftp = client.open_sftp()
with sftp.open(remote_script, 'w') as f:
    f.write(CLEANUP)
sftp.close()

def run(cmd):
    _, out, err = client.exec_command(cmd)
    o = out.read().decode('utf-8', errors='replace')
    e = err.read().decode('utf-8', errors='replace')
    if o: print(o)
    if e: print("[ERR]", e[:500])

print("=== NETTOYAGE ===")
run(f"cd {REMOTE} && ./venv/bin/python3 {remote_script}")

run(f"rm -f {remote_script}")
client.close()
print("=== FIN ===")
