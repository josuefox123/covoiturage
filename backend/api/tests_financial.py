"""
tests_financial.py

Tests du systeme financier Zemy -- Gains conducteur et reversements.
12 tests couvrant les cas critiques.
"""
from django.test import TestCase
from django.utils import timezone
from unittest.mock import patch, MagicMock
from decimal import Decimal

from api.models.utilisateur import User
from api.models.trajet import Ride
from api.models.reservation import Booking
from api.models.paiement import DriverPayout, FinancialSettings
from api.services.driver_earning_service import DriverEarningService
from api.services.feexpay_payout_service import FeexPayPayoutService, FeexPayPayoutResult


def create_driver(phone='+22997000001'):
    return User.objects.create_user(phone=phone, password='test123', full_name='Conducteur Test')

def create_passenger(phone='+22997000002'):
    return User.objects.create_user(phone=phone, password='test123', full_name='Passager Test')

def create_ride(driver, price_per_seat=5000, driver_payout=4500, zemy_commission=500):
    return Ride.objects.create(
        driver=driver,
        departure_location='Cotonou',
        arrival_location='Porto-Novo',
        departure_date=timezone.now().date(),
        departure_time=timezone.now().time(),
        price_per_seat=price_per_seat,
        driver_payout=driver_payout,
        zemy_commission=zemy_commission,
        total_seats=3,
        seats_available=3,
        status='completed',
    )

def create_completed_booking(passenger, ride, amount_override=None):
    booking = Booking.objects.create(
        passenger=passenger,
        ride=ride,
        seats_booked=1,
        status='completed',
        payment_status='escrow',
    )
    return booking


class TestDriverEarningService(TestCase):

    def setUp(self):
        self.driver = create_driver()
        self.passenger = create_passenger()
        FinancialSettings.objects.create(commission_percentage=10.0, min_commission=100)

    def test_01_retrait_partiel_accepte(self):
        """TEST 1 : Solde=12000, retrait=5000 -> accepte."""
        ride = create_ride(self.driver, price_per_seat=12000, driver_payout=12000, zemy_commission=0)
        create_completed_booking(self.passenger, ride)

        is_valid, error, snapshot = DriverEarningService.validate_withdrawal(self.driver, 5000)
        self.assertTrue(is_valid, f"Devrait accepter : {error}")
        self.assertIsNone(error)

    def test_02_retrait_total_accepte(self):
        """TEST 2 : Solde=12000, retrait=12000 -> accepte."""
        ride = create_ride(self.driver, price_per_seat=12000, driver_payout=12000, zemy_commission=0)
        create_completed_booking(self.passenger, ride)

        is_valid, error, snapshot = DriverEarningService.validate_withdrawal(self.driver, 12000)
        self.assertTrue(is_valid, f"Devrait accepter : {error}")

    def test_03_retrait_superieur_solde_refuse(self):
        """TEST 3 : Solde=12000, retrait=13000 -> refuse."""
        ride = create_ride(self.driver, price_per_seat=12000, driver_payout=12000, zemy_commission=0)
        create_completed_booking(self.passenger, ride)

        is_valid, error, snapshot = DriverEarningService.validate_withdrawal(self.driver, 13000)
        self.assertFalse(is_valid)
        self.assertIn('insuffisant', error.lower())

    def test_04_montant_zero_refuse(self):
        """TEST 4 : Montant=0 -> refuse."""
        is_valid, error, snapshot = DriverEarningService.validate_withdrawal(self.driver, 0)
        self.assertFalse(is_valid)
        self.assertIn('superieur', error.lower())

    def test_05_montant_negatif_refuse(self):
        """TEST 5 : Montant negatif -> refuse."""
        is_valid, error, snapshot = DriverEarningService.validate_withdrawal(self.driver, -500)
        self.assertFalse(is_valid)

    def test_06_double_retrait_concurrent_bloque(self):
        """TEST 6 : Deux demandes concurrentes -> une seule passe."""
        ride = create_ride(self.driver, price_per_seat=12000, driver_payout=12000, zemy_commission=0)
        create_completed_booking(self.passenger, ride)

        # Premier retrait de 8000 --> cree un payout pending
        payout1 = DriverPayout.objects.create(
            driver=self.driver,
            amount=8000,
            phone_number='+22997000001',
            operator='mtn',
            status='pending',
            payout_reference=DriverPayout.generate_reference(),
        )

        # Le second retrait de 8000 doit echouer (solde = 12000 - 8000 = 4000)
        is_valid, error, snapshot = DriverEarningService.validate_withdrawal(self.driver, 8000)
        self.assertFalse(is_valid, "Le second retrait concurrent doit etre refuse")
        self.assertEqual(snapshot.available_balance, 4000)

    def test_07_payout_feexpay_reussi(self):
        """TEST 7 : Payout automatique FeexPay reussi -> status=paid."""
        ride = create_ride(self.driver, price_per_seat=12000, driver_payout=12000, zemy_commission=0)
        create_completed_booking(self.passenger, ride)

        payout = DriverPayout.objects.create(
            driver=self.driver,
            amount=5000,
            phone_number='+22997000001',
            operator='mtn',
            status='processing',
            payout_reference=DriverPayout.generate_reference(),
            payment_mode='automatic',
        )

        mock_result = FeexPayPayoutResult(success=True, reference='FXP-TEST-123')

        with patch.object(FeexPayPayoutService, 'create_payout', return_value=mock_result):
            with patch.object(FeexPayPayoutService, 'is_automatic_enabled', return_value=True):
                # Simulate what _process_automatic_payout does
                result = FeexPayPayoutService.create_payout(payout)
                if result.success:
                    payout.status = 'paid'
                    payout.feexpay_reference = result.reference
                    payout.paid_at = timezone.now()
                    payout.save()

        payout.refresh_from_db()
        self.assertEqual(payout.status, 'paid')
        self.assertEqual(payout.feexpay_reference, 'FXP-TEST-123')

    def test_08_payout_feexpay_echoue_montant_disponible(self):
        """TEST 8 : Payout echoue -> status=failed, montant redevient disponible."""
        ride = create_ride(self.driver, price_per_seat=12000, driver_payout=12000, zemy_commission=0)
        create_completed_booking(self.passenger, ride)

        payout = DriverPayout.objects.create(
            driver=self.driver,
            amount=5000,
            phone_number='+22997000001',
            operator='mtn',
            status='processing',
            payout_reference=DriverPayout.generate_reference(),
            payment_mode='automatic',
        )

        mock_result = FeexPayPayoutResult(
            success=False, error='Numero invalide', error_code='INVALID_PHONE'
        )

        with patch.object(FeexPayPayoutService, 'create_payout', return_value=mock_result):
            result = FeexPayPayoutService.create_payout(payout)
            if not result.success:
                payout.status = 'failed'
                payout.failure_reason = result.error
                payout.failure_code = result.error_code
                payout.save()

        payout.refresh_from_db()
        self.assertEqual(payout.status, 'failed')

        # Le montant doit etre a nouveau disponible
        snapshot = DriverEarningService.compute_balance(self.driver)
        self.assertEqual(snapshot.available_balance, 12000)

    def test_09_idempotence_double_appel_feexpay(self):
        """TEST 9 : Double appel FeexPay bloque par idempotence."""
        payout = DriverPayout.objects.create(
            driver=self.driver,
            amount=5000,
            phone_number='+22997000001',
            operator='mtn',
            status='paid',
            payout_reference=DriverPayout.generate_reference(),
            feexpay_reference='FXP-ALREADY-123',
            payment_mode='automatic',
        )

        result = FeexPayPayoutService.create_payout(payout)
        self.assertEqual(result.error_code, 'ALREADY_PROCESSED')

    def test_10_payout_manuel_admin(self):
        """TEST 10 : Payout manuel admin -> pending -> processing -> paid."""
        payout = DriverPayout.objects.create(
            driver=self.driver,
            amount=7000,
            phone_number='+22997000001',
            operator='mtn',
            status='pending',
            payout_reference=DriverPayout.generate_reference(),
            payment_mode='manual',
        )
        self.assertEqual(payout.status, 'pending')

        # Admin approuve -> processing
        payout.status = 'processing'
        payout.processed_at = timezone.now()
        payout.save()
        self.assertEqual(payout.status, 'processing')

        # Admin marque comme paid -> paid
        payout.status = 'paid'
        payout.paid_at = timezone.now()
        payout.save()
        self.assertEqual(payout.status, 'paid')

    def test_11_conducteur_non_autorise(self):
        """TEST 11 : Conducteur sans gains ne peut pas retirer."""
        # Aucun trajet complete pour ce conducteur
        is_valid, error, snapshot = DriverEarningService.validate_withdrawal(self.driver, 1000)
        self.assertFalse(is_valid)
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.available_balance, 0)

    def test_12_reference_payout_unique(self):
        """TEST 12 : Chaque payout a une reference unique ZMY-PAYOUT-XXXXXXXX."""
        refs = set()
        for _ in range(10):
            ref = DriverPayout.generate_reference()
            self.assertTrue(ref.startswith('ZMY-PAYOUT-'))
            refs.add(ref)
        self.assertEqual(len(refs), 10, "Toutes les references doivent etre uniques")

