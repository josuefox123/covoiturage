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

htpath = "/home/ewnhmjym/public_html/zemy.erika-app.com/.htaccess"

sftp = client.open_sftp()
new_content = """DirectoryIndex disabled

<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /

# Autoriser l'accès direct aux dossiers media et static
RewriteRule ^(media|static)(/.*)?$ - [L]

# ==============================
# WEBSOCKET & API PROXY (HTTP 1.1 UPGRADE PASS)
# ==============================
RewriteRule ^ws/(.*)$ http://127.0.0.1:8014/ws/$1 [P,L]
RewriteRule ^api/ws/(.*)$ http://127.0.0.1:8014/api/ws/$1 [P,L]

# Si l'URL est /api/_nuxt_icon, on la redirige vers Nuxt
RewriteCond %{REQUEST_URI} ^/api/_nuxt_icon
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]

# API Django HTTP
RewriteRule ^api/(.*)$ http://127.0.0.1:8014/api/$1 [P,L]

# Eviter boucle infinie sur index.php
RewriteCond %{REQUEST_URI} ^/index.php$
RewriteRule ^(.*)$ http://127.0.0.1:3001/ [P,L]

# Tout le reste vers Nuxt Frontend
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
</IfModule>
"""

with sftp.file(htpath, 'w') as f:
    f.write(new_content)
sftp.close()

# Touch .htaccess to reload LiteSpeed
client.exec_command(f"touch '{htpath}'")

print("=== HTACCESS UPDATED TO HTTP PROXY FOR LITESPEED UPGRADE PASS ===")

cmd_jwt = """/home/ewnhmjym/zemy/backend/venv/bin/python3 -c "from rest_framework_simplejwt.tokens import AccessToken; from api.models import User; u = User.objects.get(id='8bf045ac-cb4e-43f0-aaeb-d247160c0528'); print(str(AccessToken.for_user(u)))" """
_, stdout, _ = client.exec_command(cmd_jwt)
jwt_token = stdout.read().decode('utf-8').strip()

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
