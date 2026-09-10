"""
Zemy — Modeles Notification : Notification
"""
from django.db import models
import uuid
from .utilisateur import User

class Notification(models.Model):
    """
    Modèle de notification.

    Rôle :
        Alerte les utilisateurs d'événements importants (trajet confirmé, message).

    Index :
        - (user, is_read, created_at) : optimise la requête badge/listing fréquente
          SELECT * FROM notification WHERE user=X AND is_read=false ORDER BY created_at DESC
          (exécutée toutes les 30s par BadgeContext)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    type = models.CharField(max_length=50, null=True, blank=True)
    data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            # BUG8 FIX : index composé pour la requête badge (user + is_read + tri date)
            models.Index(fields=['user', 'is_read', '-created_at'], name='notif_user_unread_idx'),
        ]

    def __str__(self):
        title = self.title or 'Notification'
        recipient = (getattr(self.user, 'email', None) or getattr(self.user, 'phone', None)) if self.user else 'All'
        return f"Notification {title} to {recipient}"

