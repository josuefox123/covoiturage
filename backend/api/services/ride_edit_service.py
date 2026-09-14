"""
==============================================================
Fichier : ride_edit_service.py

Description :
Service unique centralisé côté Backend pour gérer l'éligibilité et
la modification sécurisée/atomique d'un trajet déjà publié par un conducteur.
==============================================================
"""
from datetime import datetime, date, time as time_type
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
import logging

from ..models import Ride, Booking, RideWaypoint, RideLeg
from ..fcm import create_and_send_notification

logger = logging.getLogger(__name__)

# Statuts de réservation qui empêchent strictement toute modification du trajet
BLOCKING_BOOKING_STATUSES = ['confirmed', 'started', 'completed', 'payment_processing']

# Statuts de réservation en attente qui peuvent être annulés proprement lors d'une modification
PENDING_BOOKING_STATUSES = ['pending', 'pending_driver', 'pending_passenger', 'pending_payment']

class RideEditService:

    @staticmethod
    def get_departure_datetime(ride: Ride) -> datetime:
        """Calcule le Datetime complet et aware du départ d'un trajet."""
        dep_time = ride.departure_time
        if isinstance(dep_time, str):
            try:
                dep_time = datetime.strptime(dep_time.split('.')[0], '%H:%M:%S').time()
            except ValueError:
                try:
                    dep_time = datetime.strptime(dep_time, '%H:%M').time()
                except ValueError:
                    dep_time = datetime.min.time()
        elif not isinstance(dep_time, time_type):
            dep_time = datetime.min.time()

        naive_dt = datetime.combine(ride.departure_date, dep_time)
        if timezone.is_aware(naive_dt):
            return naive_dt
        return timezone.make_aware(naive_dt)

    @classmethod
    def check_editability(cls, ride: Ride, user) -> tuple[bool, str | None]:
        """
        Vérifie l'éligibilité d'un trajet à la modification.
        Retourne (can_edit: bool, edit_block_reason: str|None).
        """
        if not user or user.is_anonymous:
            return False, "NOT_OWNER"

        if ride.driver_id != user.id and not getattr(user, 'is_staff', False):
            return False, "NOT_OWNER"

        if ride.status == 'cancelled':
            return False, "TRIP_CANCELLED"

        if ride.status == 'completed':
            return False, "TRIP_COMPLETED"

        if ride.status == 'started':
            return False, "TRIP_STARTED"

        # Comparaison stricte avec la date ET l'heure courante de départ
        departure_dt = cls.get_departure_datetime(ride)
        if departure_dt <= timezone.now():
            return False, "TRIP_PASSED"

        # Vérification des réservations bloquantes (confirmées, embarquées, payées ou en cours de paiement)
        has_blocking_booking = ride.bookings.filter(status__in=BLOCKING_BOOKING_STATUSES).exists()
        if has_blocking_booking:
            return False, "BOOKING_CONFIRMED"

        return True, None

    @classmethod
    def update_ride(cls, ride_id, user, data: dict) -> Ride:
        """
        Modifie un trajet de manière atomique sous verrou BDD.
        Annule les réservations pending et régénère l'itinéraire si nécessaire.
        """
        with transaction.atomic():
            # Verrouiller l'instance en base de données pour empêcher les courses concurrentes
            try:
                ride = Ride.objects.select_for_update().get(id=ride_id)
            except Ride.DoesNotExist:
                raise ValidationError({"error": "Trajet introuvable."})

            # Vérifier l'éligibilité sur l'instance verrouillée
            can_edit, reason = cls.check_editability(ride, user)
            if not can_edit:
                raise ValidationError({
                    "error": f"Ce trajet ne peut pas être modifié ({reason}).",
                    "edit_block_reason": reason
                })

            # 1. Traitement des réservations en attente (pending)
            pending_bookings = list(ride.bookings.filter(status__in=PENDING_BOOKING_STATUSES))
            for booking in pending_bookings:
                booking.status = 'cancelled'
                booking.save(update_fields=['status'])
                
                passenger = booking.passenger
                b_id = str(booking.id)
                r_id = str(ride.id)

                # Notifier le passager après le commit de la transaction
                transaction.on_commit(lambda p=passenger, b=b_id, r=r_id: create_and_send_notification(
                    user=p,
                    title="Réservation annulée — Trajet modifié",
                    message="Le conducteur a modifié les informations de ce trajet. Votre demande de réservation a donc été annulée. Vous pouvez effectuer une nouvelle demande avec les nouvelles conditions.",
                    data={'type': 'booking_cancelled_ride_edited', 'booking_id': b, 'ride_id': r, 'screen': 'trips'}
                ))

            # 2. Détecter si les lieux/stopovers ont changé (nécessite régénération d'itinéraire)
            new_departure = data.get('departure_location', ride.departure_location)
            new_arrival = data.get('arrival_location', ride.arrival_location)
            new_stopovers = data.get('stopovers', ride.stopovers)

            route_changed = (
                new_departure != ride.departure_location or
                new_arrival != ride.arrival_location or
                new_stopovers != ride.stopovers or
                'departure_latitude' in data or
                'arrival_latitude' in data
            )

            # 3. Mise à jour des champs du trajet
            fields_to_update = []

            # Mettre à jour les lieux/coordonnées si présents dans data
            for loc_field in ['departure_location', 'arrival_location', 'stopovers',
                              'departure_latitude', 'departure_longitude',
                              'arrival_latitude', 'arrival_longitude',
                              'departure_place_id', 'arrival_place_id']:
                if loc_field in data:
                    setattr(ride, loc_field, data[loc_field])
                    fields_to_update.append(loc_field)

            if 'departure_date' in data:
                ride.departure_date = data['departure_date']
                fields_to_update.append('departure_date')

            if 'departure_time' in data:
                ride.departure_time = data['departure_time']
                fields_to_update.append('departure_time')

            if 'total_seats' in data:
                seats_diff = int(data['total_seats']) - ride.total_seats
                ride.total_seats = int(data['total_seats'])
                ride.seats_available = max(0, ride.seats_available + seats_diff)
                fields_to_update.extend(['total_seats', 'seats_available'])

            if 'price_per_seat' in data:
                new_price = int(data['price_per_seat'])
                ride.price_per_seat = new_price
                # Recalcul de la commission par défaut (10% min 100 FCFA)
                comm = max(100, int(new_price * 0.10))
                ride.zemy_commission = comm
                ride.driver_payout = max(0, new_price - comm)
                fields_to_update.extend(['price_per_seat', 'zemy_commission', 'driver_payout'])

            if 'vehicle' in data or 'vehicle_id' in data:
                veh_id = data.get('vehicle') or data.get('vehicle_id')
                ride.vehicle_id = veh_id
                fields_to_update.append('vehicle')

            if 'description' in data:
                ride.description = data['description']
                fields_to_update.append('description')

            if 'accepts_parcels' in data:
                ride.accepts_parcels = data['accepts_parcels']
                fields_to_update.append('accepts_parcels')

            if 'parcel_price' in data or 'price_per_parcel' in data:
                val = data['price_per_parcel'] if 'price_per_parcel' in data else data['parcel_price']
                ride.price_per_parcel = int(val) if val is not None else 0
                fields_to_update.append('price_per_parcel')

            # Préférences
            for pref in ['music', 'chatty', 'airCond', 'luggageAllowed', 'luggageSize',
                         'luggageMaxWeightKg', 'luggageType', 'drivingRelay', 'petsAllowed', 'smoking', 'stopsAllowed']:
                if pref in data:
                    setattr(ride, pref, data[pref])
                    fields_to_update.append(pref)

            if fields_to_update:
                ride.save(update_fields=list(set(fields_to_update)))

            # 4. Régénération des Waypoints et Tronçons si l'itinéraire a changé
            if route_changed:
                from .publication.ride_publication_service import RidePublicationService
                RidePublicationService.generate_legs(ride)

            return ride
