import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from api.models import Ride, Booking, Payment, Vehicle, Notification
from api.controllers.rides.ride_publication_controller import RidePublicationController
from api.serializers import RideSerializer
from api.payments.services import PaymentService
from api.services.search_service import SearchService

User = get_user_model()

class FunctionalSearchPaymentTestCase(APITestCase):
    """
    Suite de tests fonctionnels pour Recherche, Correspondances, Paiement FeexPay & Notifications.
    """

    def setUp(self):
        # 1. Conducteurs
        self.driver1 = User.objects.create_user(phone="+22997001111", password="password", full_name="Conducteur 1", is_verified=True)
        self.driver2 = User.objects.create_user(phone="+22997002222", password="password", full_name="Conducteur 2", is_verified=True)

        self.vehicle1 = Vehicle.objects.create(owner=self.driver1, brand_model="Peugeot 308", license_plate="AA-100-RB", color="Gris", vehicle_type="voiture")
        self.vehicle2 = Vehicle.objects.create(owner=self.driver2, brand_model="Bajaj Moto", license_plate="BB-200-RB", color="Rouge", vehicle_type="moto")

        # 2. Passager
        self.passenger = User.objects.create_user(phone="+22997333333", password="password", full_name="Passager Test", is_verified=True)

    def test_01_recherche_et_filtres(self):
        """Test de recherche directe et filtrage par type de véhicule."""
        data_ride1 = {
            "departure_location": "Cotonou",
            "arrival_location": "Bohicon",
            "departure_date": datetime.date.today().strftime("%Y-%m-%d"),
            "departure_time": "08:00:00",
            "driver_payout": 2000,
            "total_seats": 4,
            "seats_available": 4,
            "vehicle": str(self.vehicle1.id),
            "departure_latitude": 6.3654,
            "departure_longitude": 2.4333,
            "arrival_latitude": 7.1782,
            "arrival_longitude": 2.0667,
            "distance_km": 130.0,
            "duration_min": 120
        }
        data_ride2 = {
            "departure_location": "Cotonou",
            "arrival_location": "Bohicon",
            "departure_date": datetime.date.today().strftime("%Y-%m-%d"),
            "departure_time": "09:00:00",
            "driver_payout": 1500,
            "total_seats": 1,
            "seats_available": 1,
            "vehicle": str(self.vehicle2.id),
            "departure_latitude": 6.3654,
            "departure_longitude": 2.4333,
            "arrival_latitude": 7.1782,
            "arrival_longitude": 2.0667,
            "distance_km": 130.0,
            "duration_min": 120
        }

        RidePublicationController.publish_ride(self.driver1, data_ride1, RideSerializer)
        RidePublicationController.publish_ride(self.driver2, data_ride2, RideSerializer)

        # Recherche tous les véhicules pour Cotonou -> Bohicon
        self.client.force_authenticate(user=self.passenger)
        res_all = self.client.get("/api/rides/?departure=Cotonou&destination=Bohicon")
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)
        results = res_all.json()
        directs = results["directs"] if isinstance(results, dict) and "directs" in results else results
        self.assertGreaterEqual(len(directs), 2)

        # Recherche uniquement les motos
        res_moto = self.client.get("/api/rides/?departure=Cotonou&destination=Bohicon&vehicle_type=moto")
        self.assertEqual(res_moto.status_code, status.HTTP_200_OK)

    def test_02_flux_paiement_et_notifications(self):
        """Test de création de réservation, initiation du paiement FeexPay et vérification."""
        # 1. Publier un trajet
        data = {
            "departure_location": "Cotonou",
            "arrival_location": "Ouidah",
            "departure_date": (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
            "departure_time": "14:00:00",
            "driver_payout": 1000,
            "total_seats": 3,
            "seats_available": 3,
            "vehicle": str(self.vehicle1.id),
            "departure_latitude": 6.3654,
            "departure_longitude": 2.4333,
            "arrival_latitude": 6.3667,
            "arrival_longitude": 2.0833,
            "distance_km": 40.0,
            "duration_min": 45
        }
        res_pub = RidePublicationController.publish_ride(self.driver1, data, RideSerializer)
        ride = Ride.objects.get(id=res_pub["id"])

        # 2. Créer une réservation (statut initial: pending)
        self.client.force_authenticate(user=self.passenger)
        res_book = self.client.post("/api/bookings/", {
            "ride": str(ride.id),
            "seats_booked": 1,
            "departure_location": "Cotonou",
            "arrival_location": "Ouidah"
        }, format="json")
        self.assertEqual(res_book.status_code, status.HTTP_201_CREATED)
        booking_id = res_book.json()["id"]

        # 2b. Le conducteur accepte la demande
        self.client.force_authenticate(user=self.driver1)
        res_accept = self.client.post(f"/api/bookings/{booking_id}/accept/", format="json")
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)

        # 2c. Le passager doit accepter la proposition (nouvelle règle de flux systématique)
        self.client.force_authenticate(user=self.passenger)
        res_pass_accept = self.client.post(f"/api/bookings/{booking_id}/passenger_accept/", format="json")
        self.assertEqual(res_pass_accept.status_code, status.HTTP_200_OK)

        # 3. Le passager initie le paiement (statut passe à pending_payment après acceptation passager)
        self.client.force_authenticate(user=self.passenger)
        res_pay = self.client.post("/api/payments/initiate/", {
            "booking_id": booking_id
        }, format="json")
        self.assertEqual(res_pay.status_code, status.HTTP_201_CREATED)
        pay_json = res_pay.json()
        self.assertIn("payment_url", pay_json)
        self.assertIn("transaction_reference", pay_json)

        # 4. Vérifier que les notifications ont été générées en DB
        notifs = Notification.objects.filter(user=self.driver1)
        self.assertTrue(notifs.exists())
