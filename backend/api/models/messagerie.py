"""
Zemy — Modeles Messagerie : Conversation, Message, ModerationLog
"""
from django.db import models
import uuid
from typing import TYPE_CHECKING, Any
from .utilisateur import User
from .trajet import Ride

if TYPE_CHECKING:
    from .messagerie import Message

class Conversation(models.Model):
    """
    Modèle représentant une conversation de messagerie.
    
    Rôle :
        Regroupe les messages échangés entre deux utilisateurs,
        soit pour un trajet, soit pour le support.
    """
    if TYPE_CHECKING:
        messages: models.Manager['Message'] | Any
    CONVERSATION_TYPE_CHOICES = [
        ('ride', 'Ride'),
        ('support', 'Support'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation_type = models.CharField(max_length=10, choices=CONVERSATION_TYPE_CHOICES, default='ride')
    ride = models.ForeignKey(Ride, on_delete=models.SET_NULL, null=True, blank=True)
    participant_1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_1')
    participant_2 = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations_2')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"

    def __str__(self):
        return f"Conversation [{self.conversation_type}] {self.id}"

class Message(models.Model):
    """
    ModÃ¨le reprÃ©sentant un message individuel.
    
    RÃ´le :
        Stocke le texte, la piÃ¨ce jointe ou la localisation envoyÃ©e dans une conversation.
    """
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('audio', 'Audio'),
        ('file', 'File'),
        ('location', 'Location'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(blank=True, default='')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default='text')
    attachment = models.FileField(upload_to='support_attachments/', blank=True, null=True)
    location_lat = models.FloatField(blank=True, null=True)
    location_lng = models.FloatField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    is_urgent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Message"
        verbose_name_plural = "Messages"
        ordering = ['created_at']

    def __str__(self):
        return f"Message [{self.message_type}] {self.id}"

class ModerationLog(models.Model):
    """
    ModÃ¨le de log de modÃ©ration automatique.
    
    RÃ´le :
        Historique des messages filtrÃ©s ou bloquÃ©s automatiquement.
    """
    ACTION_CHOICES = [
        ('modified', 'ModifiÃ©'),
        ('blocked', 'BloquÃ©'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.SET_NULL, null=True, blank=True, related_name='moderation_logs')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='moderated_messages')
    original_content = models.TextField()
    modified_content = models.TextField(blank=True, null=True)
    action_taken = models.CharField(max_length=20, choices=ACTION_CHOICES)
    detected_types = models.JSONField(default=list, help_text="Liste des types d'informations personnelles dÃ©tectÃ©es (ex: phone, whatsapp, email)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Log de ModÃ©ration"
        verbose_name_plural = "Logs de ModÃ©ration"
        ordering = ['-created_at']

    def __str__(self):
        return f"ModÃ©ration ({self.action_taken}) - {self.sender} Ã  {self.created_at}"

