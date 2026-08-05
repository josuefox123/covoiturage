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

cmd_jwt = """/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "from rest_framework_simplejwt.tokens import AccessToken; from api.models import User; u = User.objects.get(id='8bf045ac-cb4e-43f0-aaeb-d247160c0528'); print(str(AccessToken.for_user(u)))" """
_, stdout, _ = client.exec_command(cmd_jwt)
jwt_token = stdout.read().decode('utf-8').strip()

htpath = "/home/ewnhmjym/public_html/zemy.erika-app.com/.htaccess"

rules = [
    ("RULE 1: ^ws/(.*)$ -> ws://127.0.0.1:8014/$1", """DirectoryIndex disabled
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^(media|static)(/.*)?$ - [L]
RewriteRule ^ws/(.*)$ ws://127.0.0.1:8014/$1 [P,L]
RewriteRule ^api/(.*)$ http://127.0.0.1:8014/api/$1 [P,L]
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
</IfModule>"""),

    ("RULE 2: ^ws/(.*)$ -> ws://127.0.0.1:8014/ws/$1", """DirectoryIndex disabled
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^(media|static)(/.*)?$ - [L]
RewriteRule ^ws/(.*)$ ws://127.0.0.1:8014/ws/$1 [P,L]
RewriteRule ^api/(.*)$ http://127.0.0.1:8014/api/$1 [P,L]
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
</IfModule>""")
]

sftp = client.open_sftp()

for name, ht in rules:
    print(f"\n--- TESTING {name} ---")
    with sftp.file(htpath, 'w') as f:
        f.write(ht)
    client.exec_command(f"touch '{htpath}'")
    time.sleep(1)

    cmd_wss_test = f"""/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "
import asyncio, websockets

async def test():
    uri = 'wss://zemy.erika-app.com/ws/notifications/?token={jwt_token}'
    try:
        async with websockets.connect(uri) as ws:
            print('🎉 CONNECTED SUCCESSFULLY VIA WSS!')
            msg = await ws.recv()
            print('SERVER WELCOME MESSAGE:', msg)
    except Exception as e:
        print('WSS ERROR:', type(e), e)

asyncio.run(test())
" """
    _, stdout, stderr = client.exec_command(cmd_wss_test)
    print("STDOUT:", stdout.read().decode('utf-8').strip())

sftp.close()
client.close()
