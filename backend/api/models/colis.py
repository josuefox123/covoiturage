"""
Zemy — Modeles Colis : Parcel
"""
from django.db import models
import uuid
from .utilisateur import User, Vehicle
from .trajet import Ride

class Parcel(models.Model):
    """
    ModÃ¨le d'envoi de colis.
    
    RÃ´le :
        Permet Ã  un utilisateur d'envoyer un colis via un trajet existant.
        
    Relations :
        - ride (Ride) : Le trajet transportant le colis.
        - sender_user (User) : L'utilisateur expÃ©diteur (optionnel).
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('accepted', 'AcceptÃ©'),
        ('picked_up', 'RÃ©cupÃ©rÃ©'),
        ('in_transit', 'En cours'),
        ('delivered', 'LivrÃ©'),
        ('cancelled', 'AnnulÃ©'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('escrow', 'Retenu par Zemy'),
        ('paid', 'PayÃ© au conducteur'),
        ('refunded', 'RemboursÃ©'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='parcels')
    sender_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_parcels')
    
    # Informations expÃ©diteur et destinataire
    sender_name = models.CharField(max_length=255)
    sender_phone = models.CharField(max_length=20)
    receiver_name = models.CharField(max_length=255)
    receiver_phone = models.CharField(max_length=20)
    
    # Lieux
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    
    # DÃ©tails du colis
    description = models.TextField()
    weight = models.FloatField()
    dimensions = models.CharField(max_length=50) # 'Petit', 'Moyen', 'Grand'
    estimated_value = models.IntegerField(default=0)
    photo = models.ImageField(upload_to='parcels/', blank=True, null=True)
    special_instructions = models.TextField(blank=True, null=True)
    
    # Finance
    price = models.IntegerField()
    zemy_commission = models.IntegerField(default=0)
    driver_payout = models.IntegerField(default=0)
    
    # Suivi
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    qr_code_data = models.CharField(max_length=255, blank=True, null=True, unique=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Colis"
        verbose_name_plural = "Colis"

    def __str__(self):
        return f"Colis {self.id} - {self.status}"

    def delete(self, using=None, keep_parents=False):  # type: ignore[override]
        if self.status != 'cancelled' and self.payment_status != 'refunded' and self.ride:
            from django.db.models import F
            Ride.objects.filter(id=self.ride_id).update(
                parcels_available=F('parcels_available') + 1
            )
        return super().delete(using=using, keep_parents=keep_parents)

