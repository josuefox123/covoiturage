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

from api.models import Conversation, Message
print("=== RECENT CONVERSATIONS ===")
convs = Conversation.objects.all().order_by('-created_at')[:5]
for c in convs:
    print(f"Conv ID: {c.id} | Type: {c.conversation_type} | Part1: {c.participant_1.email if c.participant_1 else 'None'} | Part2: {c.participant_2.email if c.participant_2 else 'None'} | Created: {c.created_at}")

print("\\n=== RECENT MESSAGES ===")
msgs = Message.objects.all().order_by('-created_at')[:10]
for m in msgs:
    print(f"Msg ID: {m.id} | Conv: {m.conversation.id} | Sender: {m.sender.email} | Content: {m.content} | Type: {m.message_type} | Created: {m.created_at}")
"""

remote_path = "/home/ewnhmjym/zemy/backend/inspect_chat.py"
sftp = client.open_sftp()
with sftp.file(remote_path, 'w') as f:
    f.write(inspect_script)
sftp.close()

_, stdout, stderr = client.exec_command("cd /home/ewnhmjym/zemy/backend && ./venv/bin/python3 inspect_chat.py")
print("STDOUT:")
print(stdout.read().decode('utf-8'))
print("STDERR:")
print(stderr.read().decode('utf-8'))

client.exec_command(f"rm -f {remote_path}")
client.close()
