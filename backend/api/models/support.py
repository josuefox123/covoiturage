"""
Zemy — Modeles Support : SupportTicket
"""
from django.db import models
import uuid
from .utilisateur import User

class SupportTicket(models.Model):
    CATEGORY_CHOICES = [
        ('problem_ride', 'ProblÃ¨me de trajet'),
        ('problem_parcel', 'ProblÃ¨me de colis'),
        ('payment', 'Paiement'),
        ('account', 'Compte'),
        ('driver', 'Conducteur'),
        ('suggestion', 'Suggestion'),
        ('other', 'Autre'),
    ]

    STATUS_CHOICES = [
        ('new', 'Nouveau'),
        ('in_progress', 'En cours'),
        ('resolved', 'TraitÃ©'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    name = models.CharField(max_length=255)
    email = models.EmailField()
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    ticket_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ticket de Support"
        verbose_name_plural = "Tickets de Support"
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            import datetime
            import random
            today = datetime.date.today()
            today_str = today.strftime('%Y%m%d')
            tickets_today_count = SupportTicket.objects.filter(created_at__date=today).count()
            self.ticket_number = f"ZMY-{today_str}-{(tickets_today_count + 1):05d}"
            
            while SupportTicket.objects.filter(ticket_number=self.ticket_number).exists():
                random_suffix = random.randint(10000, 99999)
                self.ticket_number = f"ZMY-{today_str}-{random_suffix}"

        super().save(*args, **kwargs)


    def __str__(self):
        return f"{self.ticket_number} - {self.name} ({self.get_status_display()})"

