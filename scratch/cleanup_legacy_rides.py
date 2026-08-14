import os
import paramiko

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    print("Connexion SSH/SFTP...")
    client.connect("node239-eu.n0c.com", port=5022, username="ewnhmjym", password="H6aYpcsK9NEzAm")
    print("Connexion reussie !")
    
    # Code Python à exécuter sur le serveur
    python_code = """import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Ride
from api.services.publication.ride_publication_service import RidePublicationService

rides = Ride.objects.all()
print(f"Nettoyage de {rides.count()} trajets...")
for r in rides:
    r.stopovers = []
    r.save()
    try:
        RidePublicationService.generate_legs(r)
        print(f"Regeneration reussie pour: {r.id}")
    except Exception as e:
        print(f"Erreur de regeneration pour: {r.id} - {e}")
"""

    sftp = client.open_sftp()
    remote_script_path = "/home/ewnhmjym/zemy/backend/cleanup_tmp.py"
    
    print("Televersement du script temporaire...")
    with sftp.file(remote_script_path, "w") as f:
        f.write(python_code)
    sftp.close()
    
    # Exécution du script
    print("Execution du script sur le serveur...")
    stdin, stdout, stderr = client.exec_command("cd /home/ewnhmjym/zemy/backend && ./venv/bin/python3 cleanup_tmp.py")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    
    if out:
        print("[STDOUT]\n" + out)
    if err:
        print("[STDERR]\n" + err)
        
    # Suppression du script temporaire
    sftp = client.open_sftp()
    sftp.remove(remote_script_path)
    sftp.close()
    
    client.close()

if __name__ == "__main__":
    main()
