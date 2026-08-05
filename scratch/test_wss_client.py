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

print("=== 1. INSTALL WEBSOCKETS ===")
_, stdout, stderr = client.exec_command("/home/ewnhmjym/zemy/backend/venv/bin/pip install websockets")
print("PIP STDOUT:", stdout.read().decode('utf-8'))
print("PIP STDERR:", stderr.read().decode('utf-8'))

print("=== 2. GENERATE VALID JWT TOKEN ===")
cmd_jwt = """/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "from rest_framework_simplejwt.tokens import AccessToken; from api.models import User; u = User.objects.get(id='8bf045ac-cb4e-43f0-aaeb-d247160c0528'); print(str(AccessToken.for_user(u)))" """
_, stdout, _ = client.exec_command(cmd_jwt)
jwt_token = stdout.read().decode('utf-8').strip()

print(f"Testing wss://zemy.erika-app.com/ws/notifications/?token={jwt_token[:15]}...")

cmd_wss_test = f"""/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "
import asyncio, websockets

async def test():
    uri = 'wss://zemy.erika-app.com/ws/notifications/?token={jwt_token}'
    try:
        async with websockets.connect(uri) as ws:
            print('CONNECT OK! Waiting for welcome message...')
            msg = await ws.recv()
            print('RECEIVED FROM SERVER:', msg)
    except Exception as e:
        print('WSS ERROR:', type(e), e)

asyncio.run(test())
" """
_, stdout, stderr = client.exec_command(cmd_wss_test)
print("STDOUT:", stdout.read().decode('utf-8'))
print("STDERR:", stderr.read().decode('utf-8'))

client.close()
