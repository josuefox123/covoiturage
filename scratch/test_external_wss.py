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

print("=== GENERATE VALID JWT TOKEN ===")
cmd_jwt = """/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "from rest_framework_simplejwt.tokens import AccessToken; from api.models import User; u = User.objects.get(id='8bf045ac-cb4e-43f0-aaeb-d247160c0528'); print(str(AccessToken.for_user(u)))" """
_, stdout, _ = client.exec_command(cmd_jwt)
jwt_token = stdout.read().decode('utf-8').strip()
print(f"Token: {jwt_token[:25]}...")

print("\n=== TEST WSS HANDSHAKE HEADERS ===")
cmd_wss = f"""/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "import urllib.request, ssl; req = urllib.request.Request('https://zemy.erika-app.com/ws/notifications/?token={jwt_token}', headers={{'Upgrade': 'websocket', 'Connection': 'Upgrade'}}); ctx = ssl.create_default_context(); res = urllib.request.urlopen(req, context=ctx); print('STATUS:', res.status); print(dict(res.headers))" """
_, stdout, stderr = client.exec_command(cmd_wss)
print("STDOUT:", stdout.read().decode('utf-8'))
print("STDERR:", stderr.read().decode('utf-8'))

client.close()
