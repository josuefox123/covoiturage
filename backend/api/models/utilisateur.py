"""
Zemy — Modeles Utilisateur : User, UserManager, Vehicle, UserPreference, VerificationRequest, PasswordResetOTP
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import uuid

class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError('Le numÃ©ro de tÃ©lÃ©phone est obligatoire')
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
    ModÃ¨le reprÃ©sentant un utilisateur du systÃ¨me Zemy.
    
    RÃ´le :
        GÃ¨re les informations de profil, l'authentification et les prÃ©fÃ©rences.
        Peut Ãªtre passager ou conducteur.
        
    Relations :
        - vehicles : VÃ©hicules possÃ©dÃ©s
        - preference : PrÃ©fÃ©rences de voyage
        - rides_driven : Trajets crÃ©Ã©s
        - bookings : RÃ©servations effectuÃ©es
    
    Contraintes :
        - Le tÃ©lÃ©phone doit Ãªtre unique.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)  # type: ignore[assignment]
    full_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    phone = models.CharField(max_length=20, unique=True, verbose_name="Email, TÃ©lÃ©phone ou Nom")
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
    ModÃ¨le reprÃ©sentant un vÃ©hicule.
    
    RÃ´le :
        Stocke les informations du vÃ©hicule d'un conducteur pour un trajet.
        
    Relations :
        - owner (User) : PropriÃ©taire du vÃ©hicule.
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
        verbose_name = "VÃ©hicule"
        verbose_name_plural = "VÃ©hicules"

    def __str__(self):
        return f"{self.brand_model} - {self.license_plate}"

class UserPreference(models.Model):
    """
    ModÃ¨le des prÃ©fÃ©rences de voyage d'un utilisateur.
    
    RÃ´le :
        DÃ©finit si l'utilisateur accepte la musique, fumer, discuter, etc.
        
    Relations :
        - user (User) : Utilisateur liÃ©.
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
    notes = models.TextField(blank=True, null=True, help_text="PrÃ©fÃ©rences personnalisÃ©es du voyageur")

    class Meta:
        verbose_name = "PrÃ©fÃ©rence Utilisateur"
        verbose_name_plural = "PrÃ©fÃ©rences Utilisateurs"

    def __str__(self):
        return f"Preferences de {self.user.phone}"

class VerificationRequest(models.Model):
    """
    ModÃ¨le de demande de vÃ©rification de compte.
    
    RÃ´le :
        Stocke les piÃ¨ces d'identitÃ© fournies par l'utilisateur pour devenir conducteur certifiÃ©.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'ApprouvÃ©e'),
        ('rejected', 'RejetÃ©e'),
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
        verbose_name = "Demande de vÃ©rification"
        verbose_name_plural = "Demandes de vÃ©rification"

    def __str__(self):
        return f"VÃ©rification pour {self.user.full_name or self.user.phone} ({self.get_status_display()})"

class PasswordResetOTP(models.Model):
    email = models.EmailField(verbose_name="Adresse email")
    code = models.CharField(max_length=6, verbose_name="Code OTP")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Date de crÃ©ation")
    attempts = models.IntegerField(default=0, verbose_name="Tentatives de vÃ©rification")
    is_verified = models.BooleanField(default=False, verbose_name="VÃ©rifiÃ©")

    class Meta:
        verbose_name = "OTP de rÃ©initialisation"
        verbose_name_plural = "OTPs de rÃ©initialisation"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} - {self.code}"

