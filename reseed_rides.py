"""
Script de re-seeding des trajets Zemy en production.
Crée des trajets de test de Calavi vers Parakou pour la semaine en cours,
avec points d'arrêt (Allada, Bohicon, Dassa) pour valider la recherche BlaBlaCar.

Usage SSH:
    python3 reseed_rides.py
"""
import os
import sys
import django
from datetime import date, timedelta, time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/home/ewnhmjym/zemy/backend')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
django.setup()

from django.contrib.auth import get_user_model
from api.models import Ride, RideLeg, RideWaypoint, Booking
from api.services.ride_service import RideService

User = get_user_model()

# Trouver Tossè
driver = User.objects.filter(full_name__icontains='toss').first() or \
         User.objects.filter(email__icontains='toss').first() or \
         User.objects.filter(phone__icontains='toss').first()

if not driver:
    print("ERREUR: Utilisateur Tosse introuvable. Utilisateurs disponibles:")
    for u in User.objects.all()[:10]:
        print(f"  - {u.full_name or u.phone} ({u.email}) id={u.id}")
    sys.exit(1)

print(f"Conducteur: {driver.full_name or driver.phone} (id={driver.id})")

# Trouver le vehicule du conducteur
vehicle = driver.vehicles.first()
if not vehicle:
    print(f"ERREUR: Pas de vehicule pour {driver.full_name or driver.phone}. Creez-en un via l'admin.")
    sys.exit(1)


print(f"Vehicule: {vehicle.brand_model} ({vehicle.vehicle_type})")

# Supprimer les anciens trajets du conducteur (et leurs dependances)
old_rides = Ride.objects.filter(driver=driver)
count = old_rides.count()
old_rides.delete()
print(f"Suppression de {count} anciens trajets.")

# Stopovers (avec coordonnees GPS)
STOPOVERS_CALAVI_PARAKOU = [
    {
        "name": "Allada",
        "latitude": 6.6706,
        "longitude": 2.0778,
        "place_id": ""
    },
    {
        "name": "Bohicon",
        "latitude": 7.1806,
        "longitude": 2.0678,
        "place_id": ""
    },
    {
        "name": "Dassa",
        "latitude": 7.7667,
        "longitude": 2.1833,
        "place_id": ""
    },
]

STOPOVERS_SANS_ARRET = []

today = date.today()
rides_created = []

# Creer 7 trajets pour les 7 prochains jours
for day_offset in range(7):
    target_date = today + timedelta(days=day_offset)

    # Alterner: 1 trajet avec stopovers, 1 trajet sans
    has_stops = (day_offset % 2 == 0)
    stopovers = STOPOVERS_CALAVI_PARAKOU if has_stops else STOPOVERS_SANS_ARRET

    ride = Ride.objects.create(
        driver=driver,
        vehicle=vehicle,
        departure_location="Calavi",
        arrival_location="Parakou",
        departure_latitude=6.4167,
        departure_longitude=2.3333,
        arrival_latitude=9.3569,
        arrival_longitude=2.6173,
        departure_place_id="",
        arrival_place_id="",
        departure_date=target_date,
        departure_time=time(6, 0, 0),
        total_seats=4,
        seats_available=4,
        price_per_seat=7000,
        driver_payout=6300,
        zemy_commission=700,
        status="active",
        stopovers=stopovers,
        distance_km=420,
        duration_min=360,
        music=True,
        smoking=False,
        chatty=True,
        air_conditioner=True,
        luggage_allowed=True,
        stops_allowed=True,
        accepts_parcels=True,
        max_parcels=2,
        max_weight_per_parcel=10.0,
        price_per_parcel=1000,
        description="Trajet Calavi-Parakou quotidien.",
    )

    # Generer les legs + waypoints
    try:
        RideService.generate_legs(ride)
        wp_count = ride.waypoints.count()
        leg_count = ride.legs.count()
        stops_label = f"avec {len(stopovers)} arrets" if stopovers else "sans arret"
        print(f"  [{target_date}] Trajet {stops_label}: {leg_count} legs, {wp_count} waypoints. ID={ride.id}")
        rides_created.append(ride)
    except Exception as e:
        print(f"  [{target_date}] ERREUR generate_legs: {e}")
        rides_created.append(ride)

print(f"\n{len(rides_created)} trajets crees avec succes.")
print("\nVerification des waypoints Allada:")
for ride in rides_created:
    allada_wps = ride.waypoints.filter(name__icontains='allada').count()
    generic_wps = ride.waypoints.count()
    print(f"  {ride.departure_date}: {generic_wps} waypoints total, {allada_wps} Allada")
