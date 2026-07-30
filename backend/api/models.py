"""
========================================================

Fichier :
models.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import uuid

class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError('Le numéro de téléphone est obligatoire')
        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(phone, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    """
    Modèle représentant un utilisateur du système Zemy.
    
    Rôle :
        Gère les informations de profil, l'authentification et les préférences.
        Peut être passager ou conducteur.
        
    Relations :
        - vehicles : Véhicules possédés
        - preference : Préférences de voyage
        - rides_driven : Trajets créés
        - bookings : Réservations effectuées
    
    Contraintes :
        - Le téléphone doit être unique.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)  # type: ignore[assignment]
    full_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    phone = models.CharField(max_length=20, unique=True, verbose_name="Email, Téléphone ou Nom")
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    rating = models.FloatField(default=0.0)
    parcels_completed = models.IntegerField(default=0)
    parcel_rating = models.FloatField(default=0.0)
    is_verified = models.BooleanField(default=False)
    fcm_token = models.CharField(max_length=500, blank=True, null=True, verbose_name="FCM Token")
    # Code pays ISO 3166-1 alpha-2 (ex: BJ, TG, CI, SN, BF, NE, CM, GA)
    country = models.CharField(
        max_length=5,
        default='BJ',
        blank=True,
        verbose_name="Code pays (ISO 2 lettres)"
    )
    created_at = models.DateTimeField(auto_now_add=True)


    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    is_archived = models.BooleanField(default=False)
    archive_reason = models.TextField(blank=True, null=True)
    archived_at = models.DateTimeField(blank=True, null=True)
    archived_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='archived_users')

    objects: UserManager = UserManager()  # type: ignore[assignment]

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self):
        return self.phone

class Vehicle(models.Model):
    """
    Modèle représentant un véhicule.
    
    Rôle :
        Stocke les informations du véhicule d'un conducteur pour un trajet.
        
    Relations :
        - owner (User) : Propriétaire du véhicule.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vehicles')
    
    VEHICLE_TYPE_CHOICES = [
        ('moto', 'Moto'),
        ('tricycle', 'Tricycle'),
        ('voiture', 'Voiture'),
    ]
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPE_CHOICES, default='voiture')
    brand_model = models.CharField(max_length=255)
    color = models.CharField(max_length=50)
    license_plate = models.CharField(max_length=50)
    driver_license_number = models.CharField(max_length=100, blank=True, null=True)
    license_expiration = models.DateField(blank=True, null=True)
    driver_license_photo = models.ImageField(upload_to='licenses/', blank=True, null=True)

    class Meta:
        verbose_name = "Véhicule"
        verbose_name_plural = "Véhicules"

    def __str__(self):
        return f"{self.brand_model} - {self.license_plate}"

class UserPreference(models.Model):
    """
    Modèle des préférences de voyage d'un utilisateur.
    
    Rôle :
        Définit si l'utilisateur accepte la musique, fumer, discuter, etc.
        
    Relations :
        - user (User) : Utilisateur lié.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preference')
    music = models.BooleanField(default=True)
    smoking = models.BooleanField(default=False)
    chatty = models.BooleanField(default=True)
    air_conditioner = models.BooleanField(default=True)
    pets_allowed = models.BooleanField(default=False)
    luggage_allowed = models.BooleanField(default=True)
    stops_allowed = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True, help_text="Préférences personnalisées du voyageur")

    class Meta:
        verbose_name = "Préférence Utilisateur"
        verbose_name_plural = "Préférences Utilisateurs"

    def __str__(self):
        return f"Preferences de {self.user.phone}"


class RideSeries(models.Model):
    """
    Modèle pour les trajets récurrents.
    
    Rôle :
        Permet de générer automatiquement des instances de trajets (`Ride`)
        selon une fréquence définie (quotidien, hebdomadaire).
        
    Relations :
        - driver (User) : Conducteur créateur.
        - vehicle (Vehicle) : Véhicule utilisé.
        - rides : Instances de trajets générées.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ride_series')
    start_date = models.DateField()
    end_date = models.DateField()
    repeat_type = models.CharField(max_length=20, default='daily')  # 'daily', 'weekly'
    week_days = models.JSONField(blank=True, null=True)  # List of numbers (0=Mon, 6=Sun)
    departure_time = models.TimeField()
    departure_location = models.CharField(max_length=255)
    arrival_location = models.CharField(max_length=255)
    price_per_seat = models.IntegerField()
    driver_payout = models.IntegerField(default=0)
    zemy_commission = models.IntegerField(default=0)
    total_seats = models.IntegerField()
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    departure_latitude = models.FloatField(blank=True, null=True)
    departure_longitude = models.FloatField(blank=True, null=True)
    arrival_latitude = models.FloatField(blank=True, null=True)
    arrival_longitude = models.FloatField(blank=True, null=True)
    
    # Colis
    accepts_parcels = models.BooleanField(default=False)
    max_parcels = models.IntegerField(default=0)
    max_weight_per_parcel = models.FloatField(default=0.0)
    max_dimensions = models.CharField(max_length=50, blank=True, null=True)
    price_per_parcel = models.IntegerField(default=0)
    allowed_parcel_types = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Série de Trajets"
        verbose_name_plural = "Séries de Trajets"

    def __str__(self):
        return f"Série de {self.driver} du {self.start_date} au {self.end_date}"

class Ride(models.Model):
    """
    Modèle représentant une instance de trajet (covoiturage).
    
    Rôle :
        Gère un trajet spécifique avec une date, un départ et une arrivée.
        Peut également inclure le transport de colis.
        
    Relations :
        - series (RideSeries) : Série parente (optionnel).
        - driver (User) : Conducteur.
        - vehicle (Vehicle) : Véhicule utilisé.
        - bookings : Réservations associées.
        - parcels : Colis associés.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('started', 'Started'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    series = models.ForeignKey(RideSeries, on_delete=models.CASCADE, null=True, blank=True, related_name='rides')
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rides_driven')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    departure_location = models.CharField(max_length=255)
    arrival_location = models.CharField(max_length=255)
    departure_date = models.DateField(db_index=True)
    departure_time = models.TimeField()
    price_per_seat = models.IntegerField()
    driver_payout = models.IntegerField(default=0)
    zemy_commission = models.IntegerField(default=0)
    total_seats = models.IntegerField()
    seats_available = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True)
    driver_latitude = models.FloatField(blank=True, null=True)
    driver_longitude = models.FloatField(blank=True, null=True)
    departure_latitude = models.FloatField(blank=True, null=True)
    departure_longitude = models.FloatField(blank=True, null=True)
    arrival_latitude = models.FloatField(blank=True, null=True)
    arrival_longitude = models.FloatField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    # Distance et durée (calculées depuis le frontend)
    distance_km = models.FloatField(blank=True, null=True)
    duration_min = models.IntegerField(blank=True, null=True)
    stopovers = models.JSONField(blank=True, null=True)

    # Identifiants Google Places (place_id) pour l'indexation précise et le cache des itinéraires
    departure_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google du départ")
    arrival_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google de l'arrivée")

    # Préférences du conducteur pour ce trajet
    music = models.BooleanField(default=True)
    smoking = models.BooleanField(default=False)
    chatty = models.BooleanField(default=True)
    air_conditioner = models.BooleanField(default=True)
    pets_allowed = models.BooleanField(default=False)
    luggage_allowed = models.BooleanField(default=True)
    stops_allowed = models.BooleanField(default=True)
    
    # Colis
    accepts_parcels = models.BooleanField(default=False)
    max_parcels = models.IntegerField(default=0)
    parcels_available = models.IntegerField(default=0)
    max_weight_per_parcel = models.FloatField(default=0.0)
    max_dimensions = models.CharField(max_length=50, blank=True, null=True)
    price_per_parcel = models.IntegerField(default=0)
    allowed_parcel_types = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Trajet"
        verbose_name_plural = "Trajets"

    def __str__(self):
        return f"Trajet {self.departure_location} -> {self.arrival_location}"

    def get_segment_price(self, departure, destination):
        """
        Calcule le prix d'un tronçon intermédiaire de ce trajet.
        """
        def extract_city(loc_str):
            if not loc_str:
                return ""
            parts = [p.strip() for p in loc_str.replace('/', ',').split(',') if p.strip()]
            if not parts:
                return loc_str.strip().lower()
            ignore = {'bénin', 'benin', 'togo', 'nigeria', 'ghana', 'burkina', 'france'}
            clean_parts = [p for p in parts if p.lower() not in ignore]
            return clean_parts[-1] if clean_parts else parts[0]

        dep_city = extract_city(departure).lower()
        arr_city = extract_city(destination).lower()

        # Liste des points de passage et tarifs
        places = [self.departure_location]
        leg_prices = []

        if self.stopovers and isinstance(self.stopovers, list):
            for s in self.stopovers:
                if isinstance(s, dict):
                    places.append(s.get('name', ''))
                    leg_prices.append(int(s.get('price', 0)))
                elif isinstance(s, str):
                    places.append(s)
                    leg_prices.append(0)
            
            last_s = self.stopovers[-1]
            if isinstance(last_s, dict):
                leg_prices.append(int(last_s.get('arrival_price', 0)))
            else:
                leg_prices.append(0)
        else:
            leg_prices.append(self.price_per_seat)
        
        places.append(self.arrival_location)
        place_cities = [extract_city(p).lower() for p in places]

        dep_idx = -1
        dest_idx = -1

        for idx, pc in enumerate(place_cities):
            if dep_city in pc:
                dep_idx = idx
                break
        
        if dep_idx != -1:
            for idx, pc in enumerate(place_cities):
                if arr_city in pc and idx > dep_idx:
                    dest_idx = idx
                    break

        if dep_idx != -1 and dest_idx != -1:
            total = 0
            for i in range(dep_idx, dest_idx):
                if i < len(leg_prices):
                    total += leg_prices[i]
            if total > 0:
                return total

        return self.price_per_seat

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
        ('pending_payment', 'En attente de paiement'),
        ('confirmed', 'Confirmée'),
        ('cancelled', 'Annulée'),
        ('payment_failed', 'Échec de paiement'),
        ('expired', 'Expirée'),
        ('completed', 'Terminée'),
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
        
    @property
    def total_amount(self):
        if self.departure_location and self.arrival_location:
            segment_price = self.ride.get_segment_price(self.departure_location, self.arrival_location)
            if segment_price:
                return self.seats_booked * segment_price
        return self.seats_booked * self.ride.price_per_seat

    @property
    def zemy_commission(self):
        settings = FinancialSettings.objects.first()
        if not settings:
            return 0
        commission_zemy = (self.total_amount * settings.commission_percentage) / 100
        return max(commission_zemy, settings.min_commission)

    @property
    def amount_paid_online(self):
        return self.total_amount

    @property
    def amount_due_to_driver(self):
        return self.total_amount - self.zemy_commission

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.status == 'confirmed':
            try:
                from django.db.models import Q
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

class Conversation(models.Model):
    """
    Modèle représentant une conversation de messagerie.
    
    Rôle :
        Regroupe les messages échangés entre deux utilisateurs,
        soit pour un trajet, soit pour le support.
    """
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
    Modèle représentant un message individuel.
    
    Rôle :
        Stocke le texte, la pièce jointe ou la localisation envoyée dans une conversation.
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

class Notification(models.Model):
    """
    Modèle de notification.
    
    Rôle :
        Alerte les utilisateurs d'événements importants (trajet confirmé, message).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification {self.title} to {self.user.email if self.user else 'All'}"

class AppBranding(models.Model):
    """
    Modèle de personnalisation de l'application.
    
    Rôle :
        Gère le logo et l'animation de démarrage (splash screen).
        Une seule instance active à la fois.
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

class VerificationRequest(models.Model):
    """
    Modèle de demande de vérification de compte.
    
    Rôle :
        Stocke les pièces d'identité fournies par l'utilisateur pour devenir conducteur certifié.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'Approuvée'),
        ('rejected', 'Rejetée'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='verification_request')
    selfie = models.ImageField(upload_to='verifications/selfies/')
    selfie_id = models.ImageField(upload_to='verifications/selfie_ids/', blank=True, null=True)
    id_front = models.ImageField(upload_to='verifications/id_fronts/')
    id_back = models.ImageField(upload_to='verifications/id_backs/')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Demande de vérification"
        verbose_name_plural = "Demandes de vérification"

    def __str__(self):
        return f"Vérification pour {self.user.full_name or self.user.phone} ({self.get_status_display()})"

class Promotion(models.Model):
    """
    Modèle de bannière promotionnelle.
    
    Rôle :
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
        return self.title

class MobileSettings(models.Model):
    """
    Modèle de configuration mobile.
    
    Rôle :
        Paramètres globaux de l'application (singleton).
    """
    show_promotions = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paramètres Mobile"
        verbose_name_plural = "Paramètres Mobile"

    def save(self, *args, **kwargs):
        self.pk = 1
        super(MobileSettings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Paramètres Mobile"

class FinancialSettings(models.Model):
    """
    Modèle de paramètres financiers.
    
    Rôle :
        Gère les taux de commission appliqués aux trajets et colis (singleton).
    """
    commission_percentage = models.FloatField(default=10.0)
    min_commission = models.IntegerField(default=100)
    max_commission = models.IntegerField(default=2000, blank=True, null=True)
    is_commission_active = models.BooleanField(default=True)

    # Tarification conseillée par km
    price_per_km = models.IntegerField(default=30, help_text="Prix conseillé en FCFA par km")
    price_margin_percent = models.IntegerField(default=20, help_text="% de marge autorisé autour du prix conseillé (min/max)")
    
    parcel_commission_percentage = models.FloatField(default=8.0)
    min_parcel_commission = models.IntegerField(default=100)
    max_parcel_commission = models.IntegerField(default=2000, blank=True, null=True)
    is_parcel_commission_active = models.BooleanField(default=True)
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paramètres Financiers"
        verbose_name_plural = "Paramètres Financiers"

    def save(self, *args, **kwargs):
        self.pk = 1
        super(FinancialSettings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Paramètres Financiers"

class RefundRequest(models.Model):
    """
    Modèle de demande de remboursement.
    
    Rôle :
        Géré par l'administrateur lorsqu'un trajet est annulé de manière conflictuelle.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'Approuvée'),
        ('rejected', 'Rejetée'),
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
    Modèle de transaction financière.
    
    Rôle :
        Historique des paiements (trajet, colis, commission Zemy).
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('completed', 'Effectué'),
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

class Parcel(models.Model):
    """
    Modèle d'envoi de colis.
    
    Rôle :
        Permet à un utilisateur d'envoyer un colis via un trajet existant.
        
    Relations :
        - ride (Ride) : Le trajet transportant le colis.
        - sender_user (User) : L'utilisateur expéditeur (optionnel).
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('accepted', 'Accepté'),
        ('picked_up', 'Récupéré'),
        ('in_transit', 'En cours'),
        ('delivered', 'Livré'),
        ('cancelled', 'Annulé'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('escrow', 'Retenu par Zemy'),
        ('paid', 'Payé au conducteur'),
        ('refunded', 'Remboursé'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='parcels')
    sender_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_parcels')
    
    # Informations expéditeur et destinataire
    sender_name = models.CharField(max_length=255)
    sender_phone = models.CharField(max_length=20)
    receiver_name = models.CharField(max_length=255)
    receiver_phone = models.CharField(max_length=20)
    
    # Lieux
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    
    # Détails du colis
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

class AuditLog(models.Model):
    """
    Modèle de log d'audit.
    
    Rôle :
        Garde une trace des actions de modération (ex: archivage de compte).
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

class ModerationLog(models.Model):
    """
    Modèle de log de modération automatique.
    
    Rôle :
        Historique des messages filtrés ou bloqués automatiquement.
    """
    ACTION_CHOICES = [
        ('modified', 'Modifié'),
        ('blocked', 'Bloqué'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.SET_NULL, null=True, blank=True, related_name='moderation_logs')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='moderated_messages')
    original_content = models.TextField()
    modified_content = models.TextField(blank=True, null=True)
    action_taken = models.CharField(max_length=20, choices=ACTION_CHOICES)
    detected_types = models.JSONField(default=list, help_text="Liste des types d'informations personnelles détectées (ex: phone, whatsapp, email)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Log de Modération"
        verbose_name_plural = "Logs de Modération"
        ordering = ['-created_at']

    def __str__(self):
        return f"Modération ({self.action_taken}) - {self.sender} à {self.created_at}"

class PopularPlace(models.Model):
    """
    Modèle représentant un lieu populaire / point d'intérêt au Bénin.
    
    Rôle :
        Permet d'avoir une base locale de lieux très connus pour accélérer la recherche 
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
        return f"{self.name} ({self.city or 'Bénin'})"


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


class PasswordResetOTP(models.Model):
    email = models.EmailField(verbose_name="Adresse email")
    code = models.CharField(max_length=6, verbose_name="Code OTP")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Date de création")
    attempts = models.IntegerField(default=0, verbose_name="Tentatives de vérification")
    is_verified = models.BooleanField(default=False, verbose_name="Vérifié")

    class Meta:
        verbose_name = "OTP de réinitialisation"
        verbose_name_plural = "OTPs de réinitialisation"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} - {self.code}"


class SupportTicket(models.Model):
    CATEGORY_CHOICES = [
        ('problem_ride', 'Problème de trajet'),
        ('problem_parcel', 'Problème de colis'),
        ('payment', 'Paiement'),
        ('account', 'Compte'),
        ('driver', 'Conducteur'),
        ('suggestion', 'Suggestion'),
        ('other', 'Autre'),
    ]

    STATUS_CHOICES = [
        ('new', 'Nouveau'),
        ('in_progress', 'En cours'),
        ('resolved', 'Traité'),
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


class DriverPayout(models.Model):
    """
    Modèle représentant une demande de virement du conducteur.

    Rôle :
        Permet au conducteur de réclamer son paiement après la confirmation
        d'un trajet terminé. L'admin traite ensuite le virement via Mobile Money.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('processing', 'En cours de traitement'),
        ('paid', 'Versé'),
        ('failed', 'Échoué'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='driver_payouts')
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='driver_payouts')
    amount = models.IntegerField(help_text="Montant net dû au conducteur en XOF")
    phone_number = models.CharField(max_length=30, help_text="Numéro Mobile Money du conducteur")
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


class RideLeg(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='legs')
    start_location = models.CharField(max_length=255)
    end_location = models.CharField(max_length=255)
    start_latitude = models.FloatField()
    start_longitude = models.FloatField()
    end_latitude = models.FloatField()
    end_longitude = models.FloatField()
    start_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google du départ du tronçon")
    end_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google de l'arrivée du tronçon")
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    seats_available = models.IntegerField()
    price = models.IntegerField()
    order = models.IntegerField(help_text="Index chronologique du tronçon dans le trajet")

    class Meta:
        verbose_name = "Tronçon de trajet"
        verbose_name_plural = "Tronçons de trajets"
        ordering = ['ride', 'order']

    def __str__(self):
        return f"{self.ride.id} - Tronçon {self.order}: {self.start_location} -> {self.end_location} ({self.price} XOF)"


class DirectionsCache(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    origin_place_id = models.CharField(max_length=150, blank=True, null=True)
    destination_place_id = models.CharField(max_length=150, blank=True, null=True)
    waypoints_hash = models.CharField(max_length=64, help_text="Hash SHA256 des points d'arrêt intermédiaires ordonnés")
    route_data = models.JSONField(help_text="Données complètes de l'itinéraire retournées par l'API")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Cache d'itinéraire Google"
        verbose_name_plural = "Cache d'itinéraires Google"
        indexes = [
            models.Index(fields=['origin_place_id', 'destination_place_id', 'waypoints_hash']),
        ]

    def __str__(self):
        return f"Cache {self.origin_place_id} -> {self.destination_place_id}"
