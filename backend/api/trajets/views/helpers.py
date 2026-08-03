from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions, status
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from ...models import Ride

User = get_user_model()

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def check_availability(request):
    """
    Vérifie si un email ou un numéro de téléphone est déjà utilisé.
    """
    query_params = request.query_params if hasattr(request, 'query_params') else request.GET
    email = query_params.get('email')
    phone = query_params.get('phone')

    if not email and not phone:
        return Response({"error": "Veuillez fournir un email ou un phone."}, status=status.HTTP_400_BAD_REQUEST)

    if email and User.objects.filter(email=email).exists():
        return Response({"available": False, "field": "email"})
    if phone and User.objects.filter(phone=phone).exists():
        return Response({"available": False, "field": "phone"})

    return Response({"available": True})

def validate_driver_and_vehicle(driver, vehicle_id, departure_date, departure_time, duration_min, current_ride_id=None):
    """
    Valide les règles métier d'un conducteur et son véhicule :
    1. Compte vérifié pour publier un trajet (si c'est imposé, sinon warning log).
    2. Le conducteur n'a pas déjà un autre trajet actif/started sur la même plage horaire.
    3. Le véhicule sélectionné n'est pas déjà assigné à un autre trajet sur cette même plage.
    """
    from rest_framework.exceptions import ValidationError
    from datetime import datetime, timedelta

    if not departure_date or not departure_time:
        raise ValidationError({"error": "La date et l'heure de départ sont obligatoires."})

    try:
        from datetime import date as dt_date, time as dt_time
        if isinstance(departure_date, str):
            dep_date = datetime.strptime(departure_date, "%Y-%m-%d").date()
        else:
            dep_date = departure_date

        if isinstance(departure_time, str):
            dep_time = datetime.strptime(departure_time, "%H:%M:%S").time()
        else:
            dep_time = departure_time
    except ValueError:
        raise ValidationError({"error": "Format de date ou d'heure invalide."})

    duration = int(duration_min) if duration_min else 120
    start_dt = datetime.combine(dep_date, dep_time)
    end_dt = start_dt + timedelta(minutes=duration)

    overlap_q = Q(departure_date=dep_date) & ~Q(status='cancelled')
    if current_ride_id:
        overlap_q &= ~Q(id=current_ride_id)

    active_rides = Ride.objects.filter(overlap_q)

    for ride in active_rides:
        r_start = datetime.combine(ride.departure_date, ride.departure_time)
        r_duration = ride.duration_min if ride.duration_min else 120
        r_end = r_start + timedelta(minutes=r_duration)

        is_overlapping = (start_dt < r_end) and (end_dt > r_start)

        if is_overlapping:
            if ride.driver == driver:
                raise ValidationError({
                    "error": f"Vous avez déjà un trajet prévu ({ride.departure_location} -> {ride.arrival_location}) sur cette plage horaire ({r_start.strftime('%H:%M')} - {r_end.strftime('%H:%M')})."
                })
            if vehicle_id and ride.vehicle_id and str(ride.vehicle_id) == str(vehicle_id):
                raise ValidationError({
                    "error": f"Le véhicule sélectionné est déjà programmé sur un autre trajet en cours de {r_start.strftime('%H:%M')} à {r_end.strftime('%H:%M')}."
                })
