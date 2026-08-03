"""
Zemy — Modeles Trajet : RideSeries, Ride, RideLeg, RideWaypoint, DirectionsCache, SearchAlert
"""
from django.db import models
import uuid
from .utilisateur import User, Vehicle

class RideSeries(models.Model):
    """
    ModÃ¨le pour les trajets rÃ©currents.
    
    RÃ´le :
        Permet de gÃ©nÃ©rer automatiquement des instances de trajets (`Ride`)
        selon une frÃ©quence dÃ©finie (quotidien, hebdomadaire).
        
    Relations :
        - driver (User) : Conducteur crÃ©ateur.
        - vehicle (Vehicle) : VÃ©hicule utilisÃ©.
        - rides : Instances de trajets gÃ©nÃ©rÃ©es.
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
        verbose_name = "SÃ©rie de Trajets"
        verbose_name_plural = "SÃ©ries de Trajets"

    def __str__(self):
        return f"SÃ©rie de {self.driver} du {self.start_date} au {self.end_date}"

class Ride(models.Model):
    """
    ModÃ¨le reprÃ©sentant une instance de trajet (covoiturage).
    
    RÃ´le :
        GÃ¨re un trajet spÃ©cifique avec une date, un dÃ©part et une arrivÃ©e.
        Peut Ã©galement inclure le transport de colis.
        
    Relations :
        - series (RideSeries) : SÃ©rie parente (optionnel).
        - driver (User) : Conducteur.
        - vehicle (Vehicle) : VÃ©hicule utilisÃ©.
        - bookings : RÃ©servations associÃ©es.
        - parcels : Colis associÃ©s.
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
    # Suivi du tronÃ§on en cours (BlaBlaCar-like live tracking)
    current_leg_index = models.IntegerField(default=0, help_text="Index du tronÃ§on en cours d'exÃ©cution")
    # Acceptation automatique sans validation manuelle (mode Uber)
    auto_accept = models.BooleanField(default=False, help_text="Accepter automatiquement les demandes de rÃ©servation")
    driver_latitude = models.FloatField(blank=True, null=True)
    driver_longitude = models.FloatField(blank=True, null=True)
    departure_latitude = models.FloatField(blank=True, null=True)
    departure_longitude = models.FloatField(blank=True, null=True)
    arrival_latitude = models.FloatField(blank=True, null=True)
    arrival_longitude = models.FloatField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    # Distance et durÃ©e (calculÃ©es depuis le frontend)
    distance_km = models.FloatField(blank=True, null=True)
    duration_min = models.IntegerField(blank=True, null=True)
    stopovers = models.JSONField(blank=True, null=True)

    # Identifiants Google Places (place_id) pour l'indexation prÃ©cise et le cache des itinÃ©raires
    departure_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google du dÃ©part")
    arrival_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google de l'arrivÃ©e")

    # PrÃ©fÃ©rences du conducteur pour ce trajet
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
        Calcule le prix d'un tronÃ§on intermÃ©diaire de ce trajet.
        """
        def extract_city(loc_str):
            if not loc_str:
                return ""
            parts = [p.strip() for p in loc_str.replace('/', ',').split(',') if p.strip()]
            if not parts:
                return loc_str.strip().lower()
            ignore = {'bÃ©nin', 'benin', 'togo', 'nigeria', 'ghana', 'burkina', 'france'}
            clean_parts = [p for p in parts if p.lower() not in ignore]
            return clean_parts[-1] if clean_parts else parts[0]

        dep_city = extract_city(departure).lower()
        arr_city = extract_city(destination).lower()

        # Liste des points de passage et tarifs
        places = [self.departure_location]
        leg_prices = []

        if self.stopovers and isinstance(self.stopovers, list) and len(self.stopovers) > 0:
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

class RideLeg(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='legs')
    start_location = models.CharField(max_length=255)
    end_location = models.CharField(max_length=255)
    start_latitude = models.FloatField()
    start_longitude = models.FloatField()
    end_latitude = models.FloatField()
    end_longitude = models.FloatField()
    start_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google du dÃ©part du tronÃ§on")
    end_place_id = models.CharField(max_length=255, blank=True, null=True, verbose_name="Place ID Google de l'arrivÃ©e du tronÃ§on")
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    seats_available = models.IntegerField()
    price = models.IntegerField()
    order = models.IntegerField(help_text="Index chronologique du tronÃ§on dans le trajet")
    # DonnÃ©es rÃ©elles issues de l'API Google Directions
    distance_m = models.IntegerField(default=0, help_text="Distance rÃ©elle du tronÃ§on en mÃ¨tres")
    duration_sec = models.IntegerField(default=0, help_text="DurÃ©e rÃ©elle du tronÃ§on en secondes")
    LEG_STATUS_CHOICES = [
        ('upcoming', 'Ã€ venir'),
        ('active', 'En cours'),
        ('completed', 'TerminÃ©'),
    ]
    leg_status = models.CharField(max_length=20, choices=LEG_STATUS_CHOICES, default='upcoming')

    class Meta:
        verbose_name = "TronÃ§on de trajet"
        verbose_name_plural = "TronÃ§ons de trajets"
        ordering = ['ride', 'order']

    def __str__(self):
        return f"{self.ride.id} - TronÃ§on {self.order}: {self.start_location} -> {self.end_location} ({self.price} XOF)"

class DirectionsCache(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    origin_place_id = models.CharField(max_length=150, blank=True, null=True)
    destination_place_id = models.CharField(max_length=150, blank=True, null=True)
    waypoints_hash = models.CharField(max_length=64, help_text="Hash SHA256 des points d'arrÃªt intermÃ©diaires ordonnÃ©s")
    route_data = models.JSONField(help_text="DonnÃ©es complÃ¨tes de l'itinÃ©raire retournÃ©es par l'API")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Cache d'itinÃ©raire Google"
        verbose_name_plural = "Cache d'itinÃ©raires Google"
        indexes = [
            models.Index(fields=['origin_place_id', 'destination_place_id', 'waypoints_hash']),
        ]

    def __str__(self):
        return f"Cache {self.origin_place_id} -> {self.destination_place_id}"

class RideWaypoint(models.Model):
    """
    ReprÃ©sente un point GPS significatif (ville, quartier, carrefour) automatiquement
    extrait de la polyline Google Directions lors de la publication d'un trajet.
    
    Permet la recherche BlaBlaCar-like : trouver un trajet mÃªme si le lieu
    recherchÃ© n'est pas un arrÃªt dÃ©clarÃ© mais se trouve sur la trajectoire rÃ©elle.
    
    Relations :
        - ride (Ride) : Trajet parent.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='waypoints')
    name = models.CharField(max_length=255, blank=True, help_text="Nom de la localitÃ© (extrait des steps Google ou reverse gÃ©ocodÃ©)")
    latitude = models.FloatField()
    longitude = models.FloatField()
    order = models.IntegerField(help_text="Position dans l'itinÃ©raire (index chronologique)")
    distance_from_start_m = models.IntegerField(default=0, help_text="Distance cumulÃ©e en mÃ¨tres depuis le dÃ©part du trajet")
    duration_from_start_sec = models.IntegerField(default=0, help_text="DurÃ©e cumulÃ©e en secondes depuis le dÃ©part du trajet")
    waypoint_type = models.CharField(max_length=50, default="gps", choices=[
        ("departure", "DÃ©part"),
        ("stopover", "ArrÃªt"),
        ("city", "Ville traversÃ©e"),
        ("gps", "Point GPS"),
        ("arrival", "ArrivÃ©e")
    ])
    leg_index = models.IntegerField(default=0, help_text="Index du RideLeg auquel appartient ce waypoint")
    is_stopover = models.BooleanField(default=False, help_text="True si c'est un arrÃªt dÃ©clarÃ© par le chauffeur")
    seats_available = models.IntegerField(default=4, help_text="Nombre de places disponibles sur le tronÃ§on partant de ce waypoint")

    class Meta:
        verbose_name = "Point de passage"
        verbose_name_plural = "Points de passage"
        ordering = ['ride', 'order']
        indexes = [
            models.Index(fields=['ride', 'order']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"{self.ride.id} - WP {self.order}: {self.name or 'Point GPS'} ({self.latitude:.4f}, {self.longitude:.4f})"

class SearchAlert(models.Model):
    """
    Alerte de recherche crÃ©Ã©e par un passager quand aucun trajet n'est disponible.
    
    Le systÃ¨me notifie automatiquement le passager dÃ¨s qu'un trajet compatible
    devient disponible (nouveau trajet publiÃ© ou place libÃ©rÃ©e).
    
    Relations :
        - passenger (User) : Passager ayant crÃ©Ã© l'alerte.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    passenger = models.ForeignKey(User, on_delete=models.CASCADE, related_name='search_alerts')
    departure_location = models.CharField(max_length=255, blank=True)
    arrival_location = models.CharField(max_length=255, blank=True)
    departure_latitude = models.FloatField(blank=True, null=True)
    departure_longitude = models.FloatField(blank=True, null=True)
    arrival_latitude = models.FloatField(blank=True, null=True)
    arrival_longitude = models.FloatField(blank=True, null=True)
    desired_date = models.DateField()
    seats_needed = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = "Alerte de recherche"
        verbose_name_plural = "Alertes de recherche"
        ordering = ['-created_at']

    def __str__(self):
        return f"Alerte {self.passenger} : {self.departure_location} -> {self.arrival_location} ({self.desired_date})"

