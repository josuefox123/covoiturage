"""
Zemy — Modeles Notification : Notification
"""
from django.db import models
import uuid
from .utilisateur import User

class Notification(models.Model):
    """
    ModÃ¨le de notification.
    
    RÃ´le :
        Alerte les utilisateurs d'Ã©vÃ©nements importants (trajet confirmÃ©, message).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    type = models.CharField(max_length=50, null=True, blank=True)
    data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        title = self.title or 'Notification'
        recipient = (getattr(self.user, 'email', None) or getattr(self.user, 'phone', None)) if self.user else 'All'
        return f"Notification {title} to {recipient}"

