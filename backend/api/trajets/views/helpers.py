from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions, status
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from ...models import Ride

User = get_user_model()


def get_query_params(request):
    """
    Retourne les query params de la requête quel que soit son type.
    - DRF Request  → request.query_params
    - Django HttpRequest brut → request.GET
    Évite AttributeError: 'HttpRequest' object has no attribute 'query_params'.
    """
    return getattr(request, 'query_params', None) or request.GET


def auto_complete_past_rides():
    """
    Auto-clôture (status='completed') les trajets actifs ou démarrés dont la date de départ
    est dépassée depuis plus de 24 heures.
    Met également à jour les réservations confirmées de ces trajets en 'completed'.

    FIX 3 : Utilisation d'un cutoff datetime timezone-aware (USE_TZ=True).
    Avant, un cutoff basé uniquement sur la date pouvait auto-compléter un trajet de 23h
    dont la durée n'était pas encore écoulée, le retirant faussement des vérifications
    de conflit et permettant la création de doublons.
    """
    from datetime import timedelta, datetime
    from django.utils import timezone
    from ...models.trajet import Ride
    from ...models.reservation import Booking

    now = timezone.now()
    # On ne touche que les trajets dont la date de départ est antérieure à (now - 24h)
    # La vérification par date seule est insuffisante : un trajet à 22h hier peut se terminer à 2h aujourd'hui
    cutoff_dt = now - timedelta(hours=24)
    cutoff_date = cutoff_dt.date()

    # Requête initiale : trajets actifs dont la date est clairement dépassée
    candidates = Ride.objects.filter(
        status__in=['active', 'started'],
        departure_date__lt=cutoff_date  # date strictement antérieure à hier
    ).only('id', 'departure_date', 'departure_time', 'duration_min', 'status')

    count = 0
    for ride in candidates:
        # FIX 3 : vérifier l'heure de fin réelle du trajet, pas juste la date
        try:
            ride_start_naive = datetime.combine(ride.departure_date, ride.departure_time)
            ride_start = timezone.make_aware(ride_start_naive) if timezone.is_naive(ride_start_naive) else ride_start_naive
            ride_duration = ride.duration_min if ride.duration_min else 120
            ride_end = ride_start + timedelta(minutes=ride_duration)

            # Ne compléter que si la fin réelle du trajet est bien passée
            if ride_end > now:
                import logging
                logging.getLogger(__name__).warning(
                    f"[AUTO-COMPLETE] Trajet {ride.id} ignoré : fin prévue à {ride_end} > maintenant {now}"
                )
                continue
        except Exception:
            # En cas d'erreur de parsing, on laisse passer la date brute
            pass

        ride.status = 'completed'
        ride.save(update_fields=['status'])
        Booking.objects.filter(
            ride=ride,
            status__in=['confirmed', 'active', 'started', 'pending_payment']
        ).update(status='completed')
        count += 1

    if count > 0:
        import logging
        logging.getLogger(__name__).info(f"[AUTO-COMPLETE] {count} ancien(s) trajet(s) dépassé(s) auto-clôturés.")
    return count


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
    1. Propriété du véhicule par le conducteur (IDOR Check).
    2. Compte vérifié pour publier un trajet (si c'est imposé, sinon warning log).
    3. Le conducteur n'a pas déjà un autre trajet ACTIF (active|started) sur la même plage horaire.
    4. Le véhicule sélectionné n'est pas déjà assigné à un trajet ACTIF sur cette même plage.

    Statuts bloquants : active, started
    Statuts NON bloquants : completed, cancelled (un trajet terminé/annulé n'est pas un conflit).
    """
    import logging
    logger = logging.getLogger(__name__)
    from rest_framework.exceptions import ValidationError
    from datetime import datetime, timedelta
    from django.utils import timezone

    # Statuts qui constituent un vrai conflit horaire
    ACTIVE_STATUSES = ['active', 'started']

    # Purge et auto-clôture automatique des anciens trajets dépassés (>24h)
    auto_complete_past_rides()

    driver_id = getattr(driver, 'id', driver)
    if not driver_id:
        raise ValidationError({"error": "Utilisateur non authentifié."})

    # ─── 1. Vérification obligatoire d'un véhicule enregistré ───────────────
    from ...models.utilisateur import Vehicle
    driver_vehicles = Vehicle.objects.filter(owner_id=driver_id)
    if not driver_vehicles.exists():
        raise ValidationError({"error": "Vous devez obligatoirement enregistrer un véhicule dans votre profil avant de pouvoir publier un trajet."})

    target_vehicle_id = getattr(vehicle_id, 'id', vehicle_id)

    if target_vehicle_id:
        try:
            vehicle_obj = Vehicle.objects.get(id=target_vehicle_id)
            if str(vehicle_obj.owner_id) != str(driver_id):
                raise ValidationError({"error": "Le véhicule sélectionné ne vous appartient pas."})
        except Vehicle.DoesNotExist:
            raise ValidationError({"error": "Le véhicule sélectionné est introuvable."})
    else:
        first_v = driver_vehicles.first()
        target_vehicle_id = first_v.id if first_v else None

    # ─── 2. Validation date/heure obligatoires ────────────────────────────────
    if not departure_date or not departure_time:
        raise ValidationError({"error": "La date et l'heure de départ sont obligatoires."})

    # ─── 3. Parsing robuste de la date ───────────────────────────────────────
    try:
        if isinstance(departure_date, str):
            dep_date = datetime.strptime(departure_date.strip(), "%Y-%m-%d").date()
        else:
            dep_date = departure_date
    except ValueError:
        raise ValidationError({"error": "Format de date invalide (attendu YYYY-MM-DD)."})

    # ─── 4. Parsing robuste de l'heure (HH:MM:SS, HH:MM, etc.) ───────────────
    try:
        if isinstance(departure_time, str):
            dep_time = None
            clean_time_str = departure_time.strip()
            for fmt in ("%H:%M:%S", "%H:%M", "%H:%M:%S.%f"):
                try:
                    dep_time = datetime.strptime(clean_time_str, fmt).time()
                    break
                except ValueError:
                    continue
            if dep_time is None:
                raise ValueError("Format non reconnu")
        elif hasattr(departure_time, 'hour'):
            dep_time = departure_time
        else:
            raise ValueError("Type d'heure invalide")
    except (ValueError, AttributeError):
        raise ValidationError({"error": "Format d'heure invalide (attendu HH:MM ou HH:MM:SS)."})

    # ─── 5. Construction des intervalles datetime pour le nouveau trajet ──────
    # FIX 2 : datetime.combine produit un datetime naïf (sans tz).
    # Avec USE_TZ=True, on le rend aware pour éviter les comparaisons faussement non-conflictuelles.
    duration = int(duration_min) if duration_min else 120
    new_start_naive = datetime.combine(dep_date, dep_time)
    new_start = timezone.make_aware(new_start_naive) if timezone.is_naive(new_start_naive) else new_start_naive
    new_end = new_start + timedelta(minutes=duration)

    # ─── 5b. Vérification stricte doublons exacts (même conducteur, même date, même heure) ──
    exact_dup_q = Q(
        driver_id=driver_id,
        departure_date=dep_date,
        departure_time=dep_time,
        status__in=ACTIVE_STATUSES,
    )
    if current_ride_id:
        exact_dup_q &= ~Q(id=current_ride_id)
    exact_dup = Ride.objects.filter(exact_dup_q).first()
    if exact_dup:
        raise ValidationError({
            "error": (
                f"Vous avez déjà un trajet identique ({exact_dup.departure_location} → {exact_dup.arrival_location}) "
                f"à la même heure ({dep_time.strftime('%H:%M')}). "
                f"Veuillez choisir un autre créneau ou annuler le trajet existant."
            )
        })

    logger.info(
        f"[RIDEPUBLISH] validate_driver_and_vehicle "
        f"driver_id={driver_id} vehicle_id={vehicle_id} "
        f"new_start={new_start} new_end={new_end} "
        f"current_ride_id={current_ride_id}"
    )

    # ─── 6. Requête sur les trajets actifs — plage élargie pour cross-midnight ─
    # On cherche sur [dep_date - 1 jour, dep_date + 1 jour] pour capturer
    # les trajets commencés la veille et se terminant après minuit.
    date_min = dep_date - timedelta(days=1)
    date_max = dep_date + timedelta(days=1)

    overlap_q = Q(
        departure_date__range=(date_min, date_max),
        status__in=ACTIVE_STATUSES,
    )

    # Exclure le trajet en cours de modification (mise à jour)
    if current_ride_id:
        overlap_q &= ~Q(id=current_ride_id)

    # Filtrer par conducteur ou véhicule (on récupère les deux et on distingue après)
    if vehicle_id:
        overlap_q &= (Q(driver_id=driver_id) | Q(vehicle_id=vehicle_id))
    else:
        overlap_q &= Q(driver_id=driver_id)

    active_rides = Ride.objects.filter(overlap_q).only(
        'id', 'driver_id', 'vehicle_id', 'departure_date', 'departure_time',
        'duration_min', 'departure_location', 'arrival_location', 'status'
    )

    # ─── 7. Vérification du chevauchement d'intervalles ───────────────────────
    for ride in active_rides:
        # FIX 2 : rendre r_start timezone-aware pour comparer avec new_start aware
        r_start_naive = datetime.combine(ride.departure_date, ride.departure_time)
        r_start = timezone.make_aware(r_start_naive) if timezone.is_naive(r_start_naive) else r_start_naive
        r_duration = ride.duration_min if ride.duration_min else 120
        r_end = r_start + timedelta(minutes=r_duration)

        # Deux intervalles se chevauchent si et seulement si :
        # existing_start < new_end  ET  existing_end > new_start
        is_overlapping = (r_start < new_end) and (r_end > new_start)

        logger.info(
            f"[RIDEPUBLISH] Checking ride {ride.id} status={ride.status} "
            f"r_start={r_start} r_end={r_end} overlap={is_overlapping}"
        )

        if is_overlapping:
            if str(ride.driver_id) == str(driver_id):
                raise ValidationError({
                    "error": (
                        f"Vous avez déjà un trajet prévu ({ride.departure_location} → {ride.arrival_location}) "
                        f"sur cette plage horaire ({r_start.strftime('%H:%M')} - {r_end.strftime('%H:%M')})."
                    )
                })
            if vehicle_id and ride.vehicle_id and str(ride.vehicle_id) == str(vehicle_id):
                raise ValidationError({
                    "error": (
                        f"Le véhicule sélectionné est déjà programmé sur un autre trajet "
                        f"de {r_start.strftime('%H:%M')} à {r_end.strftime('%H:%M')}."
                    )
                })

