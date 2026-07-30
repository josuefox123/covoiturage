"""
========================================================

Fichier :
tests.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import AuditLog, Ride, RideLeg

User = get_user_model()

class UserArchiveTestCase(APITestCase):
    def setUp(self):
        # Create an admin user
        self.admin = User.objects.create_superuser(
            phone="+22997000000",
            password="adminpassword"
        )
        self.admin.full_name = "Admin Philotéos"
        self.admin.save()

        # Create a regular user
        self.user = User.objects.create_user(
            phone="+22997111111",
            password="userpassword"
        )
        self.user.full_name = "Jean Dupont"
        self.user.email = "jean.dupont@example.com"
        self.user.save()

    def test_archive_user(self):
        # Login admin
        self.client.force_authenticate(user=self.admin)
        
        # Archive user
        url = reverse('user-archive', args=[self.user.id])
        response = self.client.post(url, {'reason': 'Non respect des conditions'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify user state
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_archived)
        self.assertFalse(self.user.is_active)
        self.assertEqual(self.user.archive_reason, 'Non respect des conditions')
        self.assertEqual(self.user.archived_by, self.admin)
        
        # Verify AuditLog created
        self.assertTrue(AuditLog.objects.filter(target_user=self.user, action='archive').exists())

    def test_login_archived_user(self):
        # Archive user
        self.user.is_archived = True
        self.user.is_active = False
        self.user.save()

        # Try password login
        url = reverse('login_user')
        response = self.client.post(url, {
            'identifier': self.user.phone,
            'password': 'userpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['detail'], "Votre compte a été archivé. Veuillez contacter le support Zemy.")

    def test_jwt_archived_user(self):
        # Generate token while active
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)

        # Archive user
        self.user.is_archived = True
        self.user.is_active = False
        self.user.save()

        # Try authenticated request using the access token
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + access_token)
        url = reverse('user-list') # list active users
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.json()['detail'], "Votre compte a été archivé. Veuillez contacter le support Zemy.")

    def test_restore_user(self):
        # Archive user first
        self.user.is_archived = True
        self.user.is_active = False
        self.user.save()

        # Login admin
        self.client.force_authenticate(user=self.admin)

        # Restore user
        url = reverse('user-restore', args=[self.user.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify user state
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_archived)
        self.assertTrue(self.user.is_active)
        self.assertIsNone(self.user.archived_by)

        # Verify AuditLog created
        self.assertTrue(AuditLog.objects.filter(target_user=self.user, action='restore').exists())

    def test_permanent_delete_user(self):
        # Login admin
        self.client.force_authenticate(user=self.admin)

        # Permanent delete user
        url = reverse('user-permanent-delete', args=[self.user.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify user deleted
        self.assertFalse(User.objects.filter(id=self.user.id).exists())

        # Verify AuditLog exists and target_user is NULL
        self.assertTrue(AuditLog.objects.filter(action='permanent_delete', target_user__isnull=True).exists())


# Create your tests here.

class CheckAvailabilityTestCase(APITestCase):
    def test_check_availability_email(self):
        url = reverse('check_availability')
        response = self.client.get(url, {'email': 'test@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['email_available'])


import datetime
from api.services.ride_service import RideService
from api.services.search_service import SearchService

class RideSearchTestCase(APITestCase):
    def setUp(self):
        # Create driver
        self.driver = User.objects.create_user(
            phone="+22997222222",
            password="driverpassword"
        )
        self.driver.is_verified = True
        self.driver.save()
        
        # Create a ride with stopovers (Cotonou -> Bohicon -> Parakou)
        self.ride = Ride.objects.create(
            driver=self.driver,
            departure_location="Cotonou, Bénin",
            departure_latitude=6.3654,
            departure_longitude=2.4333,
            arrival_location="Parakou, Bénin",
            arrival_latitude=9.3372,
            arrival_longitude=2.6303,
            departure_date=datetime.date.today(),
            departure_time=datetime.time(8, 0),
            price_per_seat=6000,
            seats_available=4,
            total_seats=4,
            duration_min=360,
            stopovers=[
                {
                    "name": "Bohicon, Bénin",
                    "latitude": 7.1782,
                    "longitude": 2.0667,
                    "price": 2000,
                    "arrival_price": 4000
                }
            ]
        )

    def test_generate_legs(self):
        # Generate legs for the ride
        RideService.generate_legs(self.ride)
        
        # We expect exactly 2 legs:
        # Leg 0: Cotonou -> Bohicon (Price: 2000)
        # Leg 1: Bohicon -> Parakou (Price: 4000)
        legs = self.ride.legs.all().order_by('order')
        self.assertEqual(legs.count(), 2)
        
        self.assertEqual(legs[0].start_location, "Cotonou, Bénin")
        self.assertEqual(legs[0].end_location, "Bohicon, Bénin")
        self.assertEqual(legs[0].price, 2000)
        self.assertEqual(legs[0].order, 0)
        
        self.assertEqual(legs[1].start_location, "Bohicon, Bénin")
        self.assertEqual(legs[1].end_location, "Parakou, Bénin")
        self.assertEqual(legs[1].price, 4000)
        self.assertEqual(legs[1].order, 1)

    def test_search_direct_match(self):
        # Generate legs
        RideService.generate_legs(self.ride)
        
        # Search for Cotonou -> Bohicon (matching leg 0)
        results = SearchService.find_rides(
            departure_lat=6.3600, departure_lon=2.4300, # Cotonou
            arrival_lat=7.1700, arrival_lon=2.0600, # Bohicon
            target_date=datetime.date.today(),
            seats_requested=1
        )
        
        self.assertEqual(len(results['directs']), 1)
        self.assertEqual(results['directs'][0]['price'], 2000)
        self.assertEqual(results['directs'][0]['ride'].id, self.ride.id)

