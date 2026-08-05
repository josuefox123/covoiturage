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

cmd_jwt = """/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "from rest_framework_simplejwt.tokens import AccessToken; from api.models import User; u = User.objects.get(id='8bf045ac-cb4e-43f0-aaeb-d247160c0528'); print(str(AccessToken.for_user(u)))" """
_, stdout, _ = client.exec_command(cmd_jwt)
jwt_token = stdout.read().decode('utf-8').strip()

print("=== TEST 1: WSS WITH ORIGIN HEADER ===")
cmd_wss_origin = f"""/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "
import asyncio, websockets

async def test():
    uri = 'wss://zemy.erika-app.com/ws/notifications/?token={jwt_token}'
    headers = {{'Origin': 'https://zemy.erika-app.com'}}
    try:
        async with websockets.connect(uri, additional_headers=headers) as ws:
            print('CONNECT WITH ORIGIN OK!')
            msg = await ws.recv()
            print('RECEIVED:', msg)
    except Exception as e:
        print('WSS ERROR WITH ORIGIN:', type(e), e)

asyncio.run(test())
" """
_, stdout, stderr = client.exec_command(cmd_wss_origin)
print("STDOUT:", stdout.read().decode('utf-8'))
print("STDERR:", stderr.read().decode('utf-8'))

print("\n=== TEST 2: CHECK DAPHNE RECENT LOG FOR HTTP 403 ===")
_, stdout, _ = client.exec_command("tail -n 25 /home/ewnhmjym/zemy/logs/backend.log")
print(stdout.read().decode('utf-8'))

client.close()
