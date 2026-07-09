from datetime import date
from django.db import transaction
from rest_framework.exceptions import ValidationError
from ..models import Booking, Ride

class BookingService:
    @staticmethod
    def create_booking(passenger, ride_id, seats_booked):
        """
        Crée une réservation sécurisée à l'état initial 'pending_payment'.
        Aucune place n'est décrémentée à ce stade.
        """
        if not passenger.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour réserver."})

        with transaction.atomic():
            # Verrouiller le trajet pour éviter les lectures concurrentes incohérentes
            try:
                ride = Ride.objects.select_for_update().get(id=ride_id)
            except Ride.DoesNotExist:
                raise ValidationError({"error": "Trajet introuvable."})

            if ride.driver == passenger:
                raise ValidationError({"error": "Vous ne pouvez pas réserver votre propre trajet."})
                
            if ride.departure_date < date.today():
                raise ValidationError({"error": "Ce trajet est déjà passé (archivé)."})
                
            if ride.status in ['started', 'completed', 'cancelled']:
                raise ValidationError({"error": "Ce trajet n'est plus disponible pour la réservation."})

            # Vérifier s'il reste assez de places
            if ride.seats_available < seats_booked:
                raise ValidationError({"error": "Nombre de places disponibles insuffisant."})

            # Vérifier si l'utilisateur a déjà une réservation active ou en attente pour ce trajet
            existing_booking = Booking.objects.filter(
                ride=ride, 
                passenger=passenger
            ).exclude(status__in=['cancelled', 'payment_failed', 'expired']).first()
            
            if existing_booking:
                # S'il y a déjà une réservation existante en attente de paiement, on la retourne au lieu de recréer
                if existing_booking.status == 'pending_payment' or existing_booking.status == 'pending':
                    return existing_booking, False
                raise ValidationError({"error": "Vous avez déjà une réservation en cours pour ce trajet."})

            # Créer la réservation à l'état pending_payment
            booking = Booking.objects.create(
                ride=ride,
                passenger=passenger,
                seats_booked=seats_booked,
                status='pending_payment',
                payment_status='pending'
            )
            return booking, True
