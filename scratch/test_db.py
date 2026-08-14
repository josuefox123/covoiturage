import os
import paramiko

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    client.connect("node239-eu.n0c.com", port=5022, username="ewnhmjym", password="H6aYpcsK9NEzAm")
    
    cmd = (
        "cd /home/ewnhmjym/zemy/backend && "
        "./venv/bin/python3 -c "
        "\"import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); django.setup(); "
        "from api.models import Ride, RideWaypoint; "
        "tot = Ride.objects.count(); "
        "has_stops = RideWaypoint.objects.filter(waypoint_type='stopover').values_list('ride_id', flat=True).distinct().count(); "
        "print('TOTAL RIDES:', tot, 'HAS STOPOVER WAYPOINTS:', has_stops)\""
    )
    
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    
    if out:
        print("[STDOUT]\n" + out)
    if err:
        print("[STDERR]\n" + err)
        
    client.close()

if __name__ == "__main__":
    main()
