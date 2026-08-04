import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from api.models import Ride, Booking, RideLeg, RideWaypoint, UserPreference, Vehicle
from api.controllers.rides.ride_publication_controller import RidePublicationController
from api.services.booking_service import BookingService
from api.bookings.booking_state_service import BookingStateService
from api.serializers import RideSerializer

User = get_user_model()

class FunctionalFlowTestCase(APITestCase):
    """
    Suite de tests fonctionnels complets pour l'ensemble des modules Zemy :
    - Publication : simple, récurrent, escales manuelles, arrêt automatique.
    - Recherche & Matching.
    - Réservation & Gestion des sièges par micro-segments.
    - Négociation de prix.
    - Annulation & Restitution de places.
    """

    def setUp(self):
        # 1. Conducteur vérifié avec véhicule
        self.driver = User.objects.create_user(
            phone="+22997001122",
            password="driverpassword",
            full_name="Chauffeur Pro"
        )
        self.driver.is_verified = True
        self.driver.save()

        self.vehicle = Vehicle.objects.create(
            owner=self.driver,
            brand_model="Toyota Corolla",
            license_plate="AB-1234-RB",
            color="Noire",
            vehicle_type="voiture"
        )

        # 2. Passager 1 vérifié
        self.passenger1 = User.objects.create_user(
            phone="+22997334455",
            password="passengerpassword1",
            full_name="Passager A"
        )
        self.passenger1.is_verified = True
        self.passenger1.save()

        # 3. Passager 2 vérifié
        self.passenger2 = User.objects.create_user(
            phone="+22997667788",
            password="passengerpassword2",
            full_name="Passager B"
        )
        self.passenger2.is_verified = True
        self.passenger2.save()

    def test_01_publication_trajet_simple_sans_escale(self):
        """Test de publication d'un trajet simple direct (Cotonou -> Porto-Novo)."""
        data = {
            "departure_location": "Cotonou, Bénin",
            "arrival_location": "Porto-Novo, Bénin",
            "departure_date": (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
            "departure_time": "08:00:00",
            "driver_payout": 1500,
            "total_seats": 4,
            "seats_available": 4,
            "vehicle": str(self.vehicle.id),
            "departure_latitude": 6.3654,
            "departure_longitude": 2.4333,
            "arrival_latitude": 6.4969,
            "arrival_longitude": 2.6289,
            "distance_km": 35.0,
            "duration_min": 45
        }

        result = RidePublicationController.publish_ride(
            user=self.driver,
            data=data,
            serializer_class=RideSerializer
        )

        ride_id = result["id"]
        ride = Ride.objects.get(id=ride_id)

        self.assertEqual(ride.driver, self.driver)
        self.assertEqual(ride.departure_location, "Cotonou, Bénin")
        self.assertEqual(ride.arrival_location, "Porto-Novo, Bénin")
        self.assertGreaterEqual(ride.price_per_seat, 1500) # Contient payout + commission
        self.assertGreaterEqual(ride.legs.count(), 1)
        self.assertGreaterEqual(ride.waypoints.count(), 2)

    def test_02_publication_trajet_simple_plusieurs_escales(self):
        """Test de publication d'un trajet avec plusieurs escales définies par le chauffeur."""
        data = {
            "departure_location": "Cotonou, Bénin",
            "arrival_location": "Parakou, Bénin",
            "departure_date": (datetime.date.today() + datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
            "departure_time": "06:30:00",
            "driver_payout": 7000,
            "total_seats": 3,
            "seats_available": 3,
            "vehicle": str(self.vehicle.id),
            "departure_latitude": 6.3654,
            "departure_longitude": 2.4333,
            "arrival_latitude": 9.3372,
            "arrival_longitude": 2.6289,
            "distance_km": 415.0,
            "duration_min": 360,
            "stopovers": [
                {
                    "name": "Bohicon, Bénin",
                    "latitude": 7.1782,
                    "longitude": 2.0667,
                    "price": 2500,
                    "arrival_price": 5000
                },
                {
                    "name": "Dassa-Zoumé, Bénin",
                    "latitude": 7.7472,
                    "longitude": 2.1839,
                    "price": 4000,
                    "arrival_price": 3500
                }
            ]
        }

        result = RidePublicationController.publish_ride(
            user=self.driver,
            data=data,
            serializer_class=RideSerializer
        )

        ride_id = result["id"]
        ride = Ride.objects.get(id=ride_id)

        self.assertEqual(len(ride.stopovers), 2)
        # Vérifie qu'il y a 3 tronçons principaux (Cotonou -> Bohicon -> Dassa -> Parakou)
        self.assertEqual(ride.legs.count(), 3)

    def test_03_publication_trajet_recurrent(self):
        """Test de publication d'une série de trajets récurrents sur 7 jours."""
        today = datetime.date.today()
        start_date = today.strftime("%Y-%m-%d")
        end_date = (today + datetime.timedelta(days=6)).strftime("%Y-%m-%d")

        data = {
            "start_date": start_date,
            "end_date": end_date,
            "repeat_type": "daily",
            "week_days": [0, 1, 2, 3, 4, 5, 6],
            "departure_location": "Abomey-Calavi, Bénin",
            "arrival_location": "Cotonou, Bénin",
            "departure_time": "07:15:00",
            "driver_payout": 500,
            "total_seats": 4,
            "vehicle": str(self.vehicle.id),
            "departure_latitude": 6.4484,
            "departure_longitude": 2.3556,
            "arrival_latitude": 6.3654,
            "arrival_longitude": 2.4333,
            "distance_km": 15.0,
            "duration_min": 30
        }

        result = RidePublicationController.publish_recurrent_rides(
            user=self.driver,
            data=data
        )

        self.assertIn("message", result)
        # Vérifie que 7 trajets ont bien été générés dans la base
        created_rides = Ride.objects.filter(driver=self.driver, departure_location="Abomey-Calavi, Bénin")
        self.assertEqual(created_rides.count(), 7)

    def test_04_cycle_reservation_negociation_allocation(self):
        """Test complet du cycle de réservation : demande -> négociation tarifaire -> acceptation -> allocation des places."""
        # 1. Publier un trajet
        data = {
            "departure_location": "Cotonou, Bénin",
            "arrival_location": "Bohicon, Bénin",
            "departure_date": (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
            "departure_time": "10:00:00",
            "driver_payout": 3000,
            "total_seats": 3,
            "seats_available": 3,
            "vehicle": str(self.vehicle.id),
            "departure_latitude": 6.3654,
            "departure_longitude": 2.4333,
            "arrival_latitude": 7.1782,
            "arrival_longitude": 2.0667,
            "distance_km": 130.0,
            "duration_min": 120
        }
        res_pub = RidePublicationController.publish_ride(self.driver, data, RideSerializer)
        ride = Ride.objects.get(id=res_pub["id"])

        # 2. Créer une réservation passager avec contre-proposition
        booking, created = BookingService.create_booking(
            passenger=self.passenger1,
            ride_id=ride.id,
            seats_booked=2,
            departure_location="Cotonou, Bénin",
            arrival_location="Bohicon, Bénin",
            passenger_proposed_price=2500,
            negotiation_message="Proposition passager 2500 FCFA"
        )
        self.assertTrue(created)
        self.assertEqual(booking.status, "pending")
        self.assertEqual(booking.passenger_proposed_price, 2500)

        # 3. Le conducteur fait une contre-offre via l'endpoint d'acceptation
        self.client.force_authenticate(user=self.driver)
        response = self.client.post(f"/api/bookings/{booking.id}/accept/", {"custom_price": 2800}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.status, "pending_passenger")
        self.assertEqual(booking.driver_counter_price, 2800)

        # 4. Le passager valide l'offre du conducteur
        self.client.force_authenticate(user=self.passenger1)
        response_pass = self.client.post(f"/api/bookings/{booking.id}/passenger_accept/", format="json")
        self.assertEqual(response_pass.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.status, "pending_payment")
        self.assertEqual(booking.custom_price, 2800)

        # 5. Allocation des places (simulation après paiement validé)
        booking.status = 'confirmed'
        booking.payment_status = 'escrow'
        booking.save()
        allocated = BookingService.allocate_seats(booking)
        self.assertTrue(allocated)

        ride.refresh_from_db()
        self.assertEqual(ride.seats_available, 1) # 3 - 2 = 1 place restante

        # 6. Annulation de la réservation et restitution des places
        success, msg = BookingService.cancel_booking(booking, cancelled_by_user=self.passenger1)
        self.assertTrue(success)

        ride.refresh_from_db()
        self.assertEqual(ride.seats_available, 3) # Restitué à 3
