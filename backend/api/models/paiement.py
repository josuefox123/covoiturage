"""
Zemy — Modeles Paiement : FinancialSettings, RefundRequest, Transaction, Payment, DriverPayout
"""
from django.db import models
import uuid
from .utilisateur import User
from .trajet import Ride

class FinancialSettings(models.Model):
    """
    ModÃ¨le de paramÃ¨tres financiers.
    
    RÃ´le :
        GÃ¨re les taux de commission appliquÃ©s aux trajets et colis (singleton).
    """
    commission_percentage = models.FloatField(default=10.0)
    min_commission = models.IntegerField(default=100)
    max_commission = models.IntegerField(default=2000, blank=True, null=True)
    is_commission_active = models.BooleanField(default=True)

    # Tarification conseillÃ©e par km
    price_per_km = models.IntegerField(default=30, help_text="Prix conseillÃ© en FCFA par km")
    price_margin_percent = models.IntegerField(default=20, help_text="% de marge autorisÃ© autour du prix conseillÃ© (min/max)")
    
    parcel_commission_percentage = models.FloatField(default=8.0)
    min_parcel_commission = models.IntegerField(default=100)
    max_parcel_commission = models.IntegerField(default=2000, blank=True, null=True)
    is_parcel_commission_active = models.BooleanField(default=True)
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ParamÃ¨tres Financiers"
        verbose_name_plural = "ParamÃ¨tres Financiers"

    def save(self, *args, **kwargs):
        self.pk = 1
        super(FinancialSettings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "ParamÃ¨tres Financiers"

class RefundRequest(models.Model):
    """
    ModÃ¨le de demande de remboursement.
    
    RÃ´le :
        GÃ©rÃ© par l'administrateur lorsqu'un trajet est annulÃ© de maniÃ¨re conflictuelle.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'ApprouvÃ©e'),
        ('rejected', 'RejetÃ©e'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='refund_requests')
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='refund_requests_as_passenger')
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='refund_requests_as_driver')
    amount = models.IntegerField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Demande de Remboursement"
        verbose_name_plural = "Demandes de Remboursement"

    def __str__(self):
        return f"Remboursement #{self.id} - {self.status}"

class Transaction(models.Model):
    """
    ModÃ¨le de transaction financiÃ¨re.
    
    RÃ´le :
        Historique des paiements (trajet, colis, commission Zemy).
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('completed', 'EffectuÃ©'),
    ]
    TYPE_CHOICES = [
        ('ride', 'Trajet'),
        ('parcel', 'Colis'),
        ('withdrawal', 'Retrait'),
        ('refund', 'Remboursement'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    ride = models.ForeignKey(Ride, on_delete=models.SET_NULL, null=True, blank=True)
    parcel = models.ForeignKey('Parcel', on_delete=models.SET_NULL, null=True, blank=True)
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='ride')
    amount = models.IntegerField(default=0)
    driver_payout = models.IntegerField(default=0)
    zemy_commission = models.IntegerField(default=0)
    total_price = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Transaction"
        verbose_name_plural = "Transactions"
        ordering = ['-created_at']

    def __str__(self):
        return f"Transaction {self.id} - {self.total_price} FCFA"

class Payment(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
        ('REFUNDED', 'Refunded'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_id = models.CharField(max_length=100, unique=True)
    amount = models.IntegerField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    booking = models.ForeignKey('Booking', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    parcel = models.ForeignKey('Parcel', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    provider = models.CharField(max_length=50, default='feexpay')
    last_verification_at = models.DateTimeField(null=True, blank=True)
    verification_attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment {self.transaction_id} ({self.status}) - {self.amount} XOF"

class DriverPayout(models.Model):
    """
    ModÃ¨le reprÃ©sentant une demande de virement du conducteur.

    RÃ´le :
        Permet au conducteur de rÃ©clamer son paiement aprÃ¨s la confirmation
        d'un trajet terminÃ©. L'admin traite ensuite le virement via Mobile Money.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('processing', 'En cours de traitement'),
        ('paid', 'VersÃ©'),
        ('failed', 'Ã‰chouÃ©'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='driver_payouts')
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='driver_payouts')
    amount = models.IntegerField(help_text="Montant net dÃ» au conducteur en XOF")
    phone_number = models.CharField(max_length=30, help_text="NumÃ©ro Mobile Money du conducteur")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(blank=True, null=True, help_text="Note de l'admin lors du traitement")
    requested_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Demande de virement conducteur"
        verbose_name_plural = "Demandes de virement conducteurs"
        ordering = ['-requested_at']
        unique_together = [('driver', 'ride')]

    def __str__(self):
        return f"Payout {self.driver} - Trajet {self.ride_id} - {self.amount} XOF ({self.status})"

