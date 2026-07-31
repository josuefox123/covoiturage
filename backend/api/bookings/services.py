from datetime import date
from django.db import transaction
from rest_framework.exceptions import ValidationError
from ..models import Booking, Ride

class BookingService:
    @staticmethod
    def create_booking(passenger, ride_id, seats_booked, departure_location=None, arrival_location=None):
        """
        Crée une réservation sécurisée à l'état initial 'pending'.
        Aucune place n'est décrémentée à ce stade.
        Le passager paye uniquement après accord du chauffeur.
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
                if existing_booking.status in ['pending_payment', 'pending']:
                    return existing_booking, False
                raise ValidationError({"error": "Vous avez déjà une réservation en cours pour ce trajet."})

            # Créer la réservation à l'état initial 'pending' (En attente de validation chauffeur)
            booking = Booking.objects.create(
                ride=ride,
                passenger=passenger,
                seats_booked=seats_booked,
                status='pending',
                payment_status='pending',
                departure_location=departure_location,
                arrival_location=arrival_location
            )
            
            # Planifier la tâche d'expiration automatique après 15 minutes (900 secondes)
            try:
                from ..tasks import expire_booking_task
                expire_booking_task.apply_async((str(booking.id),), countdown=900)
            except Exception:
                pass

            return booking, True

    @staticmethod
    def get_legs_for_booking(ride, departure_location, arrival_location):
        """
        Retourne la liste des RideLeg concernés par la réservation.
        """
        legs = list(ride.legs.all().order_by('order'))
        if not legs:
            return []
        
        def clean_loc(l):
            if not l: return ""
            return "".join(c for c in l.split(',')[0].strip().lower() if c.isalnum())
            
        dep_clean = clean_loc(departure_location)
        arr_clean = clean_loc(arrival_location)
        
        if not dep_clean or not arr_clean:
            return legs
            
        start_idx = -1
        end_idx = -1
        
        for i, leg in enumerate(legs):
            leg_start = clean_loc(leg.start_location)
            if dep_clean in leg_start or leg_start in dep_clean:
                start_idx = i
                break
                
        for i, leg in enumerate(legs):
            leg_end = clean_loc(leg.end_location)
            if arr_clean in leg_end or leg_end in arr_clean:
                end_idx = i
                if start_idx != -1 and i >= start_idx:
                    break
                    
        if start_idx != -1 and end_idx != -1 and start_idx <= end_idx:
            return legs[start_idx:end_idx + 1]
            
        return legs

    @staticmethod
    def allocate_seats(booking):
        """
        Décrémente les places sur les segments concernés par la réservation.
        Retourne True si l'allocation est réussie, False sinon.
        """
        ride = booking.ride
        booked_legs = BookingService.get_legs_for_booking(ride, booking.departure_location, booking.arrival_location)
        
        # Vérifier la disponibilité sur tous les segments concernés
        for leg in booked_legs:
            if leg.seats_available < booking.seats_booked:
                return False
                
        # Décrémenter les places sur chaque segment
        for leg in booked_legs:
            leg.seats_available -= booking.seats_booked
            leg.save()
            
        # Mettre à jour la disponibilité globale du trajet
        all_legs = list(ride.legs.all())
        if all_legs:
            ride.seats_available = min(l.seats_available for l in all_legs)
        else:
            ride.seats_available -= booking.seats_booked
        ride.save()
        return True

    @staticmethod
    def deallocate_seats(booking):
        """
        Restitue les places sur les segments concernés par la réservation.
        """
        ride = booking.ride
        booked_legs = BookingService.get_legs_for_booking(ride, booking.departure_location, booking.arrival_location)
        
        for leg in booked_legs:
            leg.seats_available += booking.seats_booked
            leg.save()
            
        all_legs = list(ride.legs.all())
        if all_legs:
            ride.seats_available = min(l.seats_available for l in all_legs)
        else:
            ride.seats_available += booking.seats_booked
        ride.save()

