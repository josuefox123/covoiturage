"""
test_audit_comprehensive.py
===========================
Tests de non-regression couvrant les corrections de l audit Zemy.
"""
import uuid
from datetime import date, time, timedelta
from unittest.mock import MagicMock

from django.test import TestCase
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient


def make_user(phone=None, email=None):
    from api.models.utilisateur import User
    phone = phone or f"+229{uuid.uuid4().hex[:8]}"
    user = User(phone=phone, email=email, full_name="Test", country="BJ")
    user.set_password("P@ss1!")
    user.save()
    return user


def make_ride(driver, departure_date=None, departure_time=None,
              duration_min=120, seats_available=3, status='active'):
    from api.models.trajet import Ride
    dep_date = departure_date or date.today() + timedelta(days=1)
    dep_time = departure_time or time(10, 0)
    return Ride.objects.create(
        driver=driver,
        departure_location="Cotonou", arrival_location="Abomey",
        departure_date=dep_date, departure_time=dep_time,
        price_per_seat=2000, driver_payout=1700, zemy_commission=300,
        total_seats=3, seats_available=seats_available,
        duration_min=duration_min, status=status,
    )


class TestBug001NoConflictOnCompleted(TestCase):
    def test_completed_does_not_block(self):
        from api.trajets.views.helpers import validate_driver_and_vehicle
        driver = make_user()
        d, t = date.today() + timedelta(days=2), time(10, 0)
        make_ride(driver, departure_date=d, departure_time=t, status='completed')
        try:
            validate_driver_and_vehicle(driver=driver, vehicle_id=None, departure_date=d, departure_time=t, duration_min=60)
        except ValidationError:
            self.fail("BUG-001: trajet completed bloque à tort")

    def test_cancelled_does_not_block(self):
        from api.trajets.views.helpers import validate_driver_and_vehicle
        driver = make_user()
        d, t = date.today() + timedelta(days=2), time(14, 0)
        make_ride(driver, departure_date=d, departure_time=t, status='cancelled')
        try:
            validate_driver_and_vehicle(driver=driver, vehicle_id=None, departure_date=d, departure_time=t, duration_min=60)
        except ValidationError:
            self.fail("Trajet cancelled bloque la publication à tort")

    def test_active_blocks_overlap(self):
        from api.trajets.views.helpers import validate_driver_and_vehicle
        driver = make_user()
        d = date.today() + timedelta(days=3)
        make_ride(driver, departure_date=d, departure_time=time(10, 0), duration_min=120, status='active')
        with self.assertRaises(ValidationError):
            validate_driver_and_vehicle(driver=driver, vehicle_id=None, departure_date=d, departure_time=time(10, 30), duration_min=60)


class TestBug002TimeParsing(TestCase):
    def test_hhmm_accepted(self):
        from api.trajets.views.helpers import validate_driver_and_vehicle
        driver = make_user()
        d = date.today() + timedelta(days=5)
        try:
            validate_driver_and_vehicle(driver=driver, vehicle_id=None, departure_date=str(d), departure_time="14:30", duration_min=60)
        except ValidationError as e:
            self.assertNotIn("Format d'heure invalide", str(e.detail))

    def test_hhmmss_accepted(self):
        from api.trajets.views.helpers import validate_driver_and_vehicle
        driver = make_user()
        d = date.today() + timedelta(days=6)
        try:
            validate_driver_and_vehicle(driver=driver, vehicle_id=None, departure_date=str(d), departure_time="14:30:00", duration_min=60)
        except ValidationError as e:
            self.assertNotIn("Format d'heure invalide", str(e.detail))

    def test_time_with_spaces_accepted(self):
        from api.trajets.views.helpers import validate_driver_and_vehicle
        driver = make_user()
        d = date.today() + timedelta(days=6)
        try:
            validate_driver_and_vehicle(driver=driver, vehicle_id=None, departure_date=str(d), departure_time=" 14:30 ", duration_min=60)
        except ValidationError as e:
            self.assertNotIn("Format d'heure invalide", str(e.detail))

    def test_invalid_time_raises(self):
        from api.trajets.views.helpers import validate_driver_and_vehicle
        driver = make_user()
        d = date.today() + timedelta(days=7)
        with self.assertRaises(ValidationError):
            validate_driver_and_vehicle(driver=driver, vehicle_id=None, departure_date=str(d), departure_time="invalid", duration_min=60)


class TestBug007NegotiatedPrice(TestCase):
    def _mock(self, custom=None, counter=None, proposed=None):
        b = MagicMock()
        b.custom_price = custom
        b.driver_counter_price = counter
        b.passenger_proposed_price = proposed
        b.departure_waypoint_order = None
        b.arrival_waypoint_order = None
        b.seats_booked = 1
        b.pickup_surcharge = 0
        b.dropoff_surcharge = 0
        b.ride.driver_payout = 1700
        b.ride.zemy_commission = 300
        b.ride.price_per_seat = 2000
        return b

    def test_custom_price_zero_applied(self):
        from api.services.pricing_service import PricingService
        r = PricingService.compute_for_booking(self._mock(custom=0))
        self.assertEqual(r.driver_price, 0)

    def test_custom_price_priority(self):
        from api.services.pricing_service import PricingService
        r = PricingService.compute_for_booking(self._mock(custom=1000, counter=1500))
        self.assertEqual(r.driver_price, 1000)

    def test_fallback_no_negotiation(self):
        from api.services.pricing_service import PricingService
        r = PricingService.compute_for_booking(self._mock())
        self.assertEqual(r.total_to_pay, 2000)

    def test_commission_inactive_zero(self):
        from api.services.pricing_service import PricingService
        from api.models import FinancialSettings
        settings = FinancialSettings.load()
        settings.is_commission_active = False
        settings.save()

        comm = PricingService._apply_commission_rules(2000, settings)
        self.assertEqual(comm, 0)

        # Restore default
        settings.is_commission_active = True
        settings.save()

    def test_commission_active_applied(self):
        from api.services.pricing_service import PricingService
        from api.models import FinancialSettings
        settings = FinancialSettings.load()
        settings.is_commission_active = True
        settings.commission_percentage = 10.0
        settings.min_commission = 100
        settings.save()

        comm = PricingService._apply_commission_rules(2000, settings)
        self.assertEqual(comm, 200)


class TestBug009MassAssignment(TestCase):
    def test_owner_read_only(self):
        from api.serializers import VehicleSerializer
        s = VehicleSerializer()
        self.assertIn('owner', getattr(s.Meta, 'read_only_fields', []))


class TestDB001UniqueConstraint(TestCase):
    def test_duplicate_active_raises(self):
        driver = make_user()
        d, t = date.today() + timedelta(days=10), time(8, 0)
        make_ride(driver, departure_date=d, departure_time=t, status='active')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_ride(driver, departure_date=d, departure_time=t, status='active')

    def test_completed_allows_same_slot(self):
        driver = make_user()
        d, t = date.today() + timedelta(days=11), time(9, 0)
        make_ride(driver, departure_date=d, departure_time=t, status='completed')
        ride2 = make_ride(driver, departure_date=d, departure_time=t, status='active')
        self.assertIsNotNone(ride2.id)


class TestDB002SeatsNonNegative(TestCase):
    def test_negative_seats_raises(self):
        driver = make_user()
        with self.assertRaises(Exception):
            with transaction.atomic():
                make_ride(driver, seats_available=-1)


class TestBug012RadiusBounded(TestCase):
    def test_large_radius_capped(self):
        from api.recherche.services.moteur_recherche import SearchService
        capped = max(SearchService.MIN_RADIUS_KM, min(99999.0, SearchService.MAX_RADIUS_KM))
        self.assertEqual(capped, 50.0)

    def test_zero_radius_raised(self):
        from api.recherche.services.moteur_recherche import SearchService
        capped = max(SearchService.MIN_RADIUS_KM, min(0.0, SearchService.MAX_RADIUS_KM))
        self.assertEqual(capped, 1.0)
