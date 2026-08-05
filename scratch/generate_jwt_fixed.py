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

cmd_jwt = """cd /home/ewnhmjym/zemy/backend && ./venv/bin/python3 -c "
import sys
sys.path.append('/home/ewnhmjym/zemy/backend')
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from rest_framework_simplejwt.tokens import AccessToken
from api.models import User
u = User.objects.get(id='8bf045ac-cb4e-43f0-aaeb-d247160c0528')
token = str(AccessToken.for_user(u))
print(token)
" """
_, stdout, stderr = client.exec_command(cmd_jwt)
jwt_token = stdout.read().decode('utf-8').strip()
err = stderr.read().decode('utf-8').strip()

print("STDOUT JWT:", jwt_token)
print("STDERR JWT:", err)

client.close()
