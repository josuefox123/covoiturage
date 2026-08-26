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

print('=== NETTOYAGE BASE DE DONNEES (SERVEUR) ===')

from api.models.utilisateur import User

total_avant = User.objects.count()
admins = list(User.objects.filter(is_staff=True).values_list('email', flat=True))
print(f'Utilisateurs avant : {total_avant}')
print(f'Admins a garder : {admins}')

# Suppression en cascade de tous les non-admins
# (trajets, reservations, messages, notifications... tout part avec)
result = User.objects.filter(is_staff=False).delete()
print('\\nObjets supprimes (cascade) :')
for model_name, count in sorted(result[1].items(), key=lambda x: -x[1]):
    if count > 0:
        print(f'  {model_name}: {count}')

print(f'\\nUtilisateurs restants : {User.objects.count()}')
for u in User.objects.all():
    print(f'  -> {u.email} | staff={u.is_staff} | superuser={u.is_superuser}')

print('=== DONE ===')
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
