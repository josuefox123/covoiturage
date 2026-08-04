import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from api.models import Ride, Vehicle
from api.controllers.rides.ride_publication_controller import RidePublicationController
from api.serializers import RideSerializer
from api.services.search_service import SearchService

User = get_user_model()

BENIN_CITIES = {
    'cotonou': {'lat': 6.3654, 'lon': 2.4333, 'name': 'Cotonou, Bénin'},
    'godomey': {'lat': 6.3811, 'lon': 2.3486, 'name': 'Godomey, Bénin'},
    'calavi':  {'lat': 6.4484, 'lon': 2.3556, 'name': 'Abomey-Calavi, Bénin'},
    'bohicon': {'lat': 7.1782, 'lon': 2.0667, 'name': 'Bohicon, Bénin'},
    'dassa':   {'lat': 7.7472, 'lon': 2.1839, 'name': 'Dassa-Zoumé, Bénin'},
    'parakou': {'lat': 9.3372, 'lon': 2.6289, 'name': 'Parakou, Bénin'},
}

class SpecificCitySearchesTestCase(APITestCase):
    """
    Vérification systématique des 5 trajets demandés :
    1. Cotonou -> Parakou
    2. Godomey -> Parakou
    3. Calavi -> Bohicon
    4. Bohicon -> Dassa
    5. Dassa -> Parakou
    """

    def setUp(self):
        self.driver = User.objects.create_user(
            phone="+22997998877",
            password="driverpassword",
            full_name="Chauffeur National",
            is_verified=True
        )

        self.vehicle = Vehicle.objects.create(
            owner=self.driver,
            brand_model="Peugeot 504",
            license_plate="CC-999-RB",
            color="Blanche",
            vehicle_type="voiture"
        )

        # Publication d'un grand trajet Cotonou -> Godomey -> Calavi -> Bohicon -> Dassa -> Parakou
        self.target_date = datetime.date.today() + datetime.timedelta(days=1)
        data = {
            "departure_location": BENIN_CITIES['cotonou']['name'],
            "arrival_location": BENIN_CITIES['parakou']['name'],
            "departure_date": self.target_date.strftime("%Y-%m-%d"),
            "departure_time": "06:00:00",
            "driver_payout": 8000,
            "total_seats": 4,
            "seats_available": 4,
            "vehicle": str(self.vehicle.id),
            "departure_latitude": BENIN_CITIES['cotonou']['lat'],
            "departure_longitude": BENIN_CITIES['cotonou']['lon'],
            "arrival_latitude": BENIN_CITIES['parakou']['lat'],
            "arrival_longitude": BENIN_CITIES['parakou']['lon'],
            "distance_km": 420.0,
            "duration_min": 360,
            "stopovers": [
                {"name": BENIN_CITIES['godomey']['name'], "latitude": BENIN_CITIES['godomey']['lat'], "longitude": BENIN_CITIES['godomey']['lon'], "price": 500, "arrival_price": 7500},
                {"name": BENIN_CITIES['calavi']['name'], "latitude": BENIN_CITIES['calavi']['lat'], "longitude": BENIN_CITIES['calavi']['lon'], "price": 1000, "arrival_price": 7000},
                {"name": BENIN_CITIES['bohicon']['name'], "latitude": BENIN_CITIES['bohicon']['lat'], "longitude": BENIN_CITIES['bohicon']['lon'], "price": 2500, "arrival_price": 5500},
                {"name": BENIN_CITIES['dassa']['name'], "latitude": BENIN_CITIES['dassa']['lat'], "longitude": BENIN_CITIES['dassa']['lon'], "price": 4000, "arrival_price": 4000},
            ]
        }

        res = RidePublicationController.publish_ride(self.driver, data, RideSerializer)
        self.ride = Ride.objects.get(id=res["id"])

    def _search_pair(self, dep_key: str, arr_key: str):
        dep = BENIN_CITIES[dep_key]
        arr = BENIN_CITIES[arr_key]
        url = f"/api/rides/?departure={dep['name']}&destination={arr['name']}&departure_latitude={dep['lat']}&departure_longitude={dep['lon']}&arrival_latitude={arr['lat']}&arrival_longitude={arr['lon']}&date={self.target_date.strftime('%Y-%m-%d')}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, f"Échec HTTP pour {dep_key} -> {arr_key}")
        data = response.json()
        if isinstance(data, dict):
            directs = data.get("directs", data.get("results", []))
        else:
            directs = data
        self.assertGreater(len(directs), 0, f"Aucun résultat trouvé pour {dep_key} -> {arr_key}")
        return directs[0]

    def test_01_cotonou_vers_parakou(self):
        """1. Recherche Cotonou -> Parakou"""
        result = self._search_pair('cotonou', 'parakou')
        self.assertIsNotNone(result)

    def test_02_godomey_vers_parakou(self):
        """2. Recherche Godomey -> Parakou"""
        result = self._search_pair('godomey', 'parakou')
        self.assertIsNotNone(result)

    def test_03_calavi_vers_bohicon(self):
        """3. Recherche Calavi -> Bohicon"""
        result = self._search_pair('calavi', 'bohicon')
        self.assertIsNotNone(result)

    def test_04_bohicon_vers_dassa(self):
        """4. Recherche Bohicon -> Dassa"""
        result = self._search_pair('bohicon', 'dassa')
        self.assertIsNotNone(result)

    def test_05_dassa_vers_parakou(self):
        """5. Recherche Dassa -> Parakou"""
        result = self._search_pair('dassa', 'parakou')
        self.assertIsNotNone(result)
