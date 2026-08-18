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
    booking = models.ForeignKey('Booking', on_delete=models.CASCADE, related_name='refund_requests')
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
    Modèle représentant une demande de virement du conducteur.

    Rôle :
        Permet au conducteur de réclamer tout ou partie de ses gains disponibles
        après la complétion d'un trajet. Supporte deux modes :
        - automatic : via l'API FeexPay Payout si configurée
        - manual    : traitement manuel par l'administrateur (fallback)
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('processing', 'En cours de traitement'),
        ('paid', 'Versé'),
        ('failed', 'Échoué'),
        ('cancelled', 'Annulé'),
    ]

    OPERATOR_CHOICES = [
        ('mtn', 'MTN Mobile Money'),
        ('moov', 'Moov Money'),
        ('celtiis', 'Celtiis Cash'),
        ('other', 'Autre'),
    ]

    PAYMENT_MODE_CHOICES = [
        ('automatic', 'Automatique (FeexPay)'),
        ('manual', 'Manuel (Admin)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='driver_payouts')
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='driver_payouts', null=True, blank=True)

    # Montant et coordonnées Mobile Money
    amount = models.IntegerField(help_text="Montant demandé en XOF")
    phone_number = models.CharField(max_length=30, help_text="Numéro Mobile Money du conducteur")
    operator = models.CharField(max_length=20, choices=OPERATOR_CHOICES, default='mtn',
                                 help_text="Opérateur Mobile Money")

    # Statut et mode
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODE_CHOICES, default='manual',
                                     help_text="Mode de paiement utilisé")

    # Références
    payout_reference = models.CharField(max_length=50, unique=True, null=True, blank=True,
                                         help_text="Référence interne Zemy (ZMY-PAYOUT-XXXXXXXX)")
    feexpay_reference = models.CharField(max_length=255, null=True, blank=True,
                                          help_text="Référence de la transaction FeexPay")

    # Notes admin
    admin_note = models.TextField(blank=True, null=True, help_text="Note de l'admin lors du traitement")

    # Gestion des échecs
    failure_reason = models.TextField(null=True, blank=True,
                                       help_text="Raison de l'échec du reversement")
    failure_code = models.CharField(max_length=50, null=True, blank=True,
                                     help_text="Code d'erreur FeexPay ou interne")

    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True,
                                         help_text="Date de passage en processing")
    paid_at = models.DateTimeField(null=True, blank=True,
                                    help_text="Date de confirmation du paiement réel")
    failed_at = models.DateTimeField(null=True, blank=True,
                                      help_text="Date d'échec du reversement")

    class Meta:
        verbose_name = "Demande de virement conducteur"
        verbose_name_plural = "Demandes de virement conducteurs"
        ordering = ['-requested_at']
        # Retiré unique_together sur (driver, ride) pour permettre les retraits partiels
        # Un conducteur peut maintenant avoir plusieurs payouts pour le même trajet

    def __str__(self):
        ref = self.payout_reference or str(self.id)[:8]
        return f"[{ref}] {self.driver} — {self.amount} XOF ({self.status})"

    @classmethod
    def generate_reference(cls):
        """Génère une référence unique ZMY-PAYOUT-XXXXXXXX."""
        import random
        import string
        while True:
            suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            ref = f"ZMY-PAYOUT-{suffix}"
            if not cls.objects.filter(payout_reference=ref).exists():
                return ref
