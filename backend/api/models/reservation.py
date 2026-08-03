"""
Zemy — Modeles Reservation : Booking
"""
from django.db import models
import uuid
from .utilisateur import User
from .trajet import Ride

class Booking(models.Model):
    """
    Modèle représentant une réservation de place(s) dans un trajet.
    
    Rôle :
        Lie un passager à un trajet et gère le statut de paiement et d'acceptation.
        
    Relations :
        - ride (Ride) : Trajet réservé.
        - passenger (User) : Passager effectuant la réservation.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('pending_driver', 'En attente de validation conducteur'),
        ('pending_passenger', 'En attente de confirmation passager'),
        ('pending_payment', 'En attente de paiement'),
        ('payment_processing', 'Paiement en cours'),
        ('confirmed', 'Confirmée'),
        ('started', 'Démarrée'),
        ('completed', 'Terminée'),
        ('cancelled', 'Annulée'),
        ('expired', 'Expirée'),
        ('payment_failed', 'Échec de paiement'),
        ('payment_refunded', 'Remboursée'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('escrow', 'Retenu par Zemy'),
        ('paid', 'Payé au conducteur'),
        ('refunded', 'Remboursé'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='bookings')
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    seats_booked = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    departure_location = models.CharField(max_length=255, blank=True, null=True)
    arrival_location = models.CharField(max_length=255, blank=True, null=True)
    departure_latitude = models.FloatField(null=True, blank=True)
    departure_longitude = models.FloatField(null=True, blank=True)
    arrival_latitude = models.FloatField(null=True, blank=True)
    arrival_longitude = models.FloatField(null=True, blank=True)
    departure_waypoint_order = models.IntegerField(null=True, blank=True, help_text="Index du waypoint de montée")
    arrival_waypoint_order = models.IntegerField(null=True, blank=True, help_text="Index du waypoint de descente")
    custom_price = models.IntegerField(blank=True, null=True, verbose_name="Prix personnalisé conducteur")
    passenger_proposed_price = models.IntegerField(blank=True, null=True, verbose_name="Prix proposé par le passager")
    driver_counter_price = models.IntegerField(blank=True, null=True, verbose_name="Contre-proposition du chauffeur")
    negotiation_message = models.TextField(blank=True, null=True, verbose_name="Message de négociation")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Réservation"
        verbose_name_plural = "Réservations"

    def __str__(self):
        return f"Reservation {self.id} pour {self.ride}"

    def delete(self, using=None, keep_parents=False):  # type: ignore[override]
        if self.status == 'confirmed' and self.ride:
            try:
                from api.bookings.services import BookingService
                BookingService.deallocate_seats(self)
            except Exception:
                from django.db.models import F
                Ride.objects.filter(id=self.ride_id).update(
                    seats_available=F('seats_available') + self.seats_booked
                )
        return super().delete(using=using, keep_parents=keep_parents)
        
    def _pricing(self):
        """
        Calcule le prix via PricingService (source de verite unique).
        Appel mis en cache sur l'instance pour eviter les requetes multiples.
        """
        if not hasattr(self, '_pricing_cache'):
            from api.services.pricing_service import PricingService
            self._pricing_cache = PricingService.compute_for_booking(self)
        return self._pricing_cache

    @property
    def total_amount(self):
        """Montant total paye par le passager (driver_price + commission) x places."""
        return self._pricing().total_to_pay

    @property
    def zemy_commission(self):
        """Commission totale conservee par Zemy (commission unitaire x places)."""
        return self._pricing().zemy_amount

    @property
    def amount_paid_online(self):
        """Montant debite via FeexPay = total_amount (driver + commission)."""
        return self._pricing().total_to_pay

    @property
    def amount_due_to_driver(self):
        """Montant verse au conducteur = driver_price x places (sans commission)."""
        return self._pricing().driver_amount


    def save(self, *args, **kwargs):
        if hasattr(self, '_pricing_cache'):
            delattr(self, '_pricing_cache')
        super().save(*args, **kwargs)
        if self.status == 'confirmed':
            try:
                from django.db.models import Q
                from api.models.messagerie import Conversation
                existing_conv = Conversation.objects.filter(
                    ride=self.ride,
                    conversation_type='ride'
                ).filter(
                    Q(participant_1=self.passenger, participant_2=self.ride.driver) |
                    Q(participant_1=self.ride.driver, participant_2=self.passenger)
                ).first()
                
                if not existing_conv:
                    Conversation.objects.create(
                        conversation_type='ride',
                        ride=self.ride,
                        participant_1=self.passenger,
                        participant_2=self.ride.driver,
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error creating conversation for booking {self.id}: {str(e)}")
