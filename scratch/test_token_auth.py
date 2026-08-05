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

# We will write a python script on the remote server
remote_script_path = "/home/ewnhmjym/zemy/backend/test_ws_auth.py"

python_script_content = """
import sys
sys.path.append('/home/ewnhmjym/zemy/backend')
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework_simplejwt.tokens import AccessToken
from api.models import User

u = User.objects.get(id='8bf045ac-cb4e-43f0-aaeb-d247160c0528')
token_str = str(AccessToken.for_user(u))
print("Generated Token:", token_str)

try:
    access_token = AccessToken(token_str)
    user_id = access_token.get('user_id')
    user = User.objects.get(id=user_id, is_active=True)
    print("SUCCESS: Authenticated user", user.id, "active:", user.is_active)
except Exception as e:
    print("FAILED:", type(e), e)
"""

sftp = client.open_sftp()
with sftp.file(remote_script_path, 'w') as f:
    f.write(python_script_content)
sftp.close()

_, stdout, stderr = client.exec_command("cd /home/ewnhmjym/zemy/backend && ./venv/bin/python3 test_ws_auth.py")
out = stdout.read().decode('utf-8').strip()
err = stderr.read().decode('utf-8').strip()

print("STDOUT:")
print(out)
if err:
    print("STDERR:")
    print(err)

# Clean up remote file
client.exec_command(f"rm -f {remote_script_path}")

client.close()
