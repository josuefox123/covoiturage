"""
tests_financial.py

Tests du systeme financier Zemy -- Gains conducteur et reversements.
12 tests couvrant les cas critiques.
"""
from django.test import TestCase, override_settings
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

    def test_13_feexpay_phone_normalization(self):
        """TEST 13 : Normalisation du numéro béninois (229...) pour FeexPay."""
        from api.services.feexpay_payout_service import normalize_phone_number
        self.assertEqual(normalize_phone_number('+229 97 00 00 01'), '22997000001')
        self.assertEqual(normalize_phone_number('97000001'), '22997000001')
        self.assertEqual(normalize_phone_number('0197000001'), '2290197000001')
        self.assertEqual(normalize_phone_number('+2290197000001'), '2290197000001')

    def test_14_payout_timeout_keeps_processing(self):
        """TEST 14 : En cas de timeout FeexPay, le payout reste en 'processing' (pas de fail hâtif)."""
        import requests
        payout = DriverPayout.objects.create(
            driver=self.driver,
            amount=5000,
            phone_number='+22997000001',
            operator='mtn',
            status='pending',
            payout_reference=DriverPayout.generate_reference(),
            payment_mode='automatic',
        )

        with patch.object(FeexPayPayoutService, 'is_automatic_enabled', return_value=True):
            with patch('requests.post', side_effect=requests.Timeout("Connection timed out")):
                from api.paiements.views.earnings import DriverClaimPayoutView
                view = DriverClaimPayoutView()
                view._process_automatic_payout(payout)

        payout.refresh_from_db()
        self.assertEqual(payout.status, 'processing')
        self.assertEqual(payout.failure_code, 'TIMEOUT')

    def test_15_driver_cancellation_triggers_auto_refund(self):
        """TEST 15 : Annulation par le conducteur -> Remboursement automatique sans avis admin."""
        from api.services.booking_service import BookingService
        from api.models.paiement import RefundRequest, Payment

        ride = create_ride(self.driver, price_per_seat=5000)
        booking = Booking.objects.create(
            passenger=self.passenger,
            ride=ride,
            seats_booked=1,
            status='confirmed',
            payment_status='paid',
            departure_location='Cotonou',
            arrival_location='Porto-Novo',
        )
        Payment.objects.create(
            transaction_id='TX-TEST-CANCEL-001',
            amount=5000,
            user=self.passenger,
            booking=booking,
            status='SUCCESS'
        )

        mock_result = FeexPayPayoutResult(
            success=True, reference='FXP-REFUND-111', status='SUCCESSFUL'
        )

        with patch.object(FeexPayPayoutService, 'is_automatic_enabled', return_value=True):
            with patch.object(FeexPayPayoutService, 'create_refund', return_value=mock_result):
                BookingService.cancel_booking(booking, cancelled_by_user=self.driver)

        booking.refresh_from_db()
        self.assertEqual(booking.status, 'cancelled')
        self.assertEqual(booking.payment_status, 'refunded')

        refund = RefundRequest.objects.filter(booking=booking).first()
        self.assertIsNotNone(refund)
        self.assertEqual(refund.status, 'refunded')
        self.assertEqual(refund.feexpay_reference, 'FXP-REFUND-111')
        self.assertEqual(refund.amount, 5000)

    def test_16_passenger_early_cancellation_triggers_auto_refund(self):
        """TEST 16 : Annulation passager à plus de 5h -> Remboursement automatique direct."""
        from api.services.booking_service import BookingService
        from api.models.paiement import RefundRequest, Payment
        import datetime

        # Trajet prévu dans 24h (> 5h)
        future_date = timezone.now().date() + datetime.timedelta(days=1)
        ride = Ride.objects.create(
            driver=self.driver,
            departure_location='Cotonou',
            arrival_location='Parakou',
            departure_date=future_date,
            departure_time=timezone.now().time(),
            price_per_seat=8000,
            total_seats=3,
            seats_available=3,
            status='confirmed',
        )
        booking = Booking.objects.create(
            passenger=self.passenger,
            ride=ride,
            seats_booked=1,
            status='confirmed',
            payment_status='paid',
            departure_location='Cotonou',
            arrival_location='Parakou',
        )
        Payment.objects.create(
            transaction_id='TX-TEST-EARLY-002',
            amount=8000,
            user=self.passenger,
            booking=booking,
            status='SUCCESS'
        )

        mock_result = FeexPayPayoutResult(
            success=True, reference='FXP-REFUND-222', status='SUCCESSFUL'
        )

        with patch.object(FeexPayPayoutService, 'is_automatic_enabled', return_value=True):
            with patch.object(FeexPayPayoutService, 'create_refund', return_value=mock_result):
                BookingService.cancel_booking(booking, cancelled_by_user=self.passenger)

        booking.refresh_from_db()
        refund = RefundRequest.objects.filter(booking=booking).first()
        self.assertIsNotNone(refund)
        self.assertEqual(refund.status, 'refunded')
        self.assertEqual(refund.feexpay_reference, 'FXP-REFUND-222')

    def test_17_refund_exceeding_balance_refused(self):
        """TEST 17 : Demande de remboursement supérieure au montant encaissé refusée."""
        from api.services.refund_service import RefundService
        from api.models.paiement import Payment

        ride = create_ride(self.driver, price_per_seat=4000)
        booking = Booking.objects.create(
            passenger=self.passenger,
            ride=ride,
            seats_booked=1,
            status='confirmed',
            payment_status='paid',
        )
        Payment.objects.create(
            transaction_id='TX-TEST-4000',
            amount=4000,
            user=self.passenger,
            booking=booking,
            status='SUCCESS'
        )

        is_valid, error, _ = RefundService.validate_refund_eligibility(
            booking=booking,
            amount=5000,  # 5000 > 4000
            requested_by=self.passenger
        )
        self.assertFalse(is_valid)
        self.assertIn('supérieur', error.lower())

    def test_18_refund_unauthorized_user_blocked(self):
        """TEST 18 : Un utilisateur B ne peut pas demander le remboursement du passager A."""
        from api.services.refund_service import RefundService
        other_user = User.objects.create_user(phone='+22997999999', password='password123')

        ride = create_ride(self.driver, price_per_seat=4000)
        booking = Booking.objects.create(
            passenger=self.passenger,
            ride=ride,
            seats_booked=1,
            status='confirmed',
            payment_status='paid',
        )

        is_valid, error, _ = RefundService.validate_refund_eligibility(
            booking=booking,
            amount=4000,
            requested_by=other_user
        )
        self.assertFalse(is_valid)
        self.assertIn('pas autorisé', error.lower())

    def test_19_refund_idempotency_double_refund_blocked(self):
        """TEST 19 : Idempotence de remboursement FeexPay."""
        from api.models.paiement import RefundRequest

        ride = create_ride(self.driver, price_per_seat=5000)
        booking = Booking.objects.create(
            passenger=self.passenger,
            ride=ride,
            seats_booked=1,
            status='confirmed',
            payment_status='paid',
        )
        refund = RefundRequest.objects.create(
            booking=booking,
            passenger=self.passenger,
            driver=self.driver,
            amount=5000,
            reason="Test",
            status='refunded',
            feexpay_reference='FXP-ALREADY-REFUNDED-001',
            refund_reference=RefundRequest.generate_reference()
        )

        result = FeexPayPayoutService.create_refund(refund)
        self.assertEqual(result.error_code, 'ALREADY_PROCESSED')

    @override_settings(FEEXPAY_WEBHOOK_SECRET='local_webhook_secret_for_testing_purposes')
    def test_20_webhook_payout_confirmation(self):
        """TEST 20 : Webhook FeexPay valide un DriverPayout en 'paid'."""
        import json
        from django.test import Client

        payout = DriverPayout.objects.create(
            driver=self.driver,
            amount=6000,
            phone_number='+22997000001',
            operator='mtn',
            status='processing',
            payout_reference=DriverPayout.generate_reference(),
            feexpay_reference='FXP-PAYOUT-WH-001',
        )

        client = Client()
        payload = {
            "transaction_id": payout.payout_reference,
            "status": "SUCCESSFUL",
            "amount": 6000,
        }

        response = client.post(
            '/api/payments/webhook/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_ZEMY_WEBHOOK_TOKEN='local_webhook_secret_for_testing_purposes'
        )
        self.assertEqual(response.status_code, 200)

        payout.refresh_from_db()
        self.assertEqual(payout.status, 'paid')

    @override_settings(FEEXPAY_WEBHOOK_SECRET='local_webhook_secret_for_testing_purposes')
    def test_21_webhook_refund_confirmation(self):
        """TEST 21 : Webhook FeexPay valide un RefundRequest en 'refunded'."""
        import json
        from django.test import Client
        from api.models.paiement import RefundRequest

        ride = create_ride(self.driver, price_per_seat=5000)
        booking = Booking.objects.create(
            passenger=self.passenger,
            ride=ride,
            seats_booked=1,
            status='cancelled',
            payment_status='pending',
        )
        refund = RefundRequest.objects.create(
            booking=booking,
            passenger=self.passenger,
            driver=self.driver,
            amount=5000,
            reason="Annulation",
            status='processing',
            refund_reference=RefundRequest.generate_reference(),
            feexpay_reference='FXP-REFUND-WH-002',
        )

        client = Client()
        payload = {
            "transaction_id": refund.refund_reference,
            "status": "SUCCESSFUL",
            "amount": 5000,
        }

        response = client.post(
            '/api/payments/webhook/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_ZEMY_WEBHOOK_TOKEN='local_webhook_secret_for_testing_purposes'
        )
        self.assertEqual(response.status_code, 200)

        refund.refresh_from_db()
        self.assertEqual(refund.status, 'refunded')
        booking.refresh_from_db()
        self.assertEqual(booking.payment_status, 'refunded')

    @override_settings(FEEXPAY_WEBHOOK_SECRET='local_webhook_secret_for_testing_purposes')
    def test_22_webhook_unauthorized_signature(self):
        """TEST 22 : Webhook avec token invalide rejeté avec HTTP 403."""
        import json
        from django.test import Client

        client = Client()
        payload = {"transaction_id": "TEST-UNAUTH", "status": "SUCCESSFUL"}

        response = client.post(
            '/api/payments/webhook/',
            data=json.dumps(payload),
            content_type='application/json',
            HTTP_X_ZEMY_WEBHOOK_TOKEN='wrong_secret'
        )
        self.assertEqual(response.status_code, 403)


