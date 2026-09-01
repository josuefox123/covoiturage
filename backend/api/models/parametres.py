"""
Zemy — Modeles Parametres applicatifs : AppBranding, MobileSettings, Promotion, PopularPlace, AuditLog
"""
from django.db import models
import uuid
from .utilisateur import User

class AppBranding(models.Model):
    """
    ModÃ¨le de personnalisation de l'application.
    
    RÃ´le :
        GÃ¨re le logo et l'animation de dÃ©marrage (splash screen).
        Une seule instance active Ã  la fois.
    """
    logo = models.ImageField(upload_to='branding/', null=True, blank=True)
    logo_scale = models.FloatField(default=1.0)
    logo_position_x = models.FloatField(default=0.0)
    logo_position_y = models.FloatField(default=0.0)
    animation_type = models.CharField(max_length=50, default='fade_scale', choices=[
        ('fade_scale', 'Fondu & Zoom'),
        ('bounce', 'Rebond'),
        ('pulse', 'Pulsation')
    ])
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # We only want one active branding configuration
        if self.is_active:
            AppBranding.objects.filter(is_active=True).update(is_active=False)
        super(AppBranding, self).save(*args, **kwargs)

    def __str__(self):
        return f"App Branding ({'Active' if self.is_active else 'Inactive'})"

class Promotion(models.Model):
    """
    ModÃ¨le de banniÃ¨re promotionnelle.
    
    RÃ´le :
        Affiche des annonces dans l'application mobile.
    """
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, blank=True, null=True)
    image = models.ImageField(upload_to='promotions/')
    color = models.CharField(max_length=20, default='#2563EB')
    icon = models.CharField(max_length=50, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position']
        verbose_name = "Promotion"
        verbose_name_plural = "Promotions"

    def __str__(self):
        return self.title or "Promotion"

class MobileSettings(models.Model):
    """
    ModÃ¨le de configuration mobile.
    
    RÃ´le :
        ParamÃ¨tres globaux de l'application (singleton).
    """
    show_promotions = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ParamÃ¨tres Mobile"
        verbose_name_plural = "ParamÃ¨tres Mobile"

    def save(self, *args, **kwargs):
        self.pk = 1
        super(MobileSettings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "ParamÃ¨tres Mobile"

class AuditLog(models.Model):
    """
    ModÃ¨le de log d'audit.
    
    RÃ´le :
        Garde une trace des actions de modÃ©ration (ex: archivage de compte).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_actions')
    target_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_events')
    action = models.CharField(max_length=50)
    reason = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Log d'Audit"
        verbose_name_plural = "Logs d'Audit"

    def __str__(self):
        return f"[{self.created_at}] {self.admin_user} -> {self.action} on {self.target_user}"

class PopularPlace(models.Model):
    """
    ModÃ¨le reprÃ©sentant un lieu populaire / point d'intÃ©rÃªt au BÃ©nin.
    
    RÃ´le :
        Permet d'avoir une base locale de lieux trÃ¨s connus pour accÃ©lÃ©rer la recherche 
        et s'affranchir des limites et lenteurs de Nominatim.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name="Nom du lieu")
    latitude = models.FloatField(verbose_name="Latitude")
    longitude = models.FloatField(verbose_name="Longitude")
    city = models.CharField(max_length=255, blank=True, null=True, verbose_name="Ville")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Lieu populaire"
        verbose_name_plural = "Lieux populaires"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.city or 'BÃ©nin'})"

