"""
driver_earning_service.py

Service centralise de calcul du solde conducteur.

REGLE ABSOLUE :
  Le backend est la seule source de verite pour le calcul des gains.
  Le frontend ne doit jamais etre utilise pour calculer ou valider un montant.

DEFINITION DES TERMES :
  gross_amount      = somme des montants bruts (total_amount des bookings confirmes)
  zemy_commission   = somme des commissions Zemy sur ces bookings
  driver_amount     = somme des gains nets conducteur (amount_due_to_driver)
  already_paid      = montants des payouts status=paid
  in_processing     = montants des payouts status=processing ou pending
  available_balance = driver_amount - already_paid - in_processing

Projet : Zemy
"""
import logging
from django.db import transaction
from django.db.models import Sum, Q

logger = logging.getLogger(__name__)


class DriverEarningsSnapshot:
    """Snapshot immuable du solde conducteur."""
    def __init__(self, gross_amount, zemy_commission, driver_amount,
                 already_paid, in_processing, available_balance,
                 eligible_bookings_ids):
        self.gross_amount = gross_amount
        self.zemy_commission = zemy_commission
        self.driver_amount = driver_amount
        self.already_paid = already_paid
        self.in_processing = in_processing
        self.available_balance = available_balance
        self.eligible_bookings_ids = eligible_bookings_ids  # IDs des bookings sources

    def to_dict(self):
        return {
            'gross_amount': self.gross_amount,
            'zemy_commission': self.zemy_commission,
            'driver_amount': self.driver_amount,
            'already_paid': self.already_paid,
            'in_processing': self.in_processing,
            'available_balance': self.available_balance,
        }


class DriverEarningService:
    """
    Service de calcul des gains conducteur.

    Utilise le PricingService existant (via les proprietes de Booking)
    comme source de verite pour les montants individuels.
    """

    @staticmethod
    def compute_balance(driver, lock: bool = False) -> DriverEarningsSnapshot:
        """
        Calcule le solde disponible d un conducteur.

        Args:
            driver (User): Le conducteur
            lock (bool): Si True, utilise select_for_update() (dans une transaction)

        Returns:
            DriverEarningsSnapshot
        """
        from api.models.reservation import Booking
        from api.models.paiement import DriverPayout

        # Bookings eligibles : trajet complete + paiement escrow ou paid
        bookings_qs = Booking.objects.filter(
            ride__driver=driver,
            status='completed',
            payment_status__in=['escrow', 'paid']
        ).select_related('ride')

        if lock:
            bookings_qs = bookings_qs.select_for_update()

        eligible_bookings = list(bookings_qs)
        eligible_ids = [b.id for b in eligible_bookings]

        # Calcul via PricingService (source de verite)
        gross_amount = 0
        zemy_commission = 0
        driver_amount = 0
        for booking in eligible_bookings:
            try:
                gross_amount += int(booking.total_amount)
                zemy_commission += int(booking.zemy_commission)
                driver_amount += int(booking.amount_due_to_driver)
            except Exception as e:
                logger.warning(f"[EARNINGS] Erreur calcul booking {booking.id}: {e}")

        # Payouts deja effectues (paid)
        already_paid = DriverPayout.objects.filter(
            driver=driver,
            status='paid'
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Payouts en cours (pending + processing) -- ces montants sont "reserves"
        in_processing = DriverPayout.objects.filter(
            driver=driver,
            status__in=['pending', 'processing']
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Solde disponible = gains nets - deja verse - en cours
        available_balance = max(0, driver_amount - already_paid - in_processing)

        return DriverEarningsSnapshot(
            gross_amount=gross_amount,
            zemy_commission=zemy_commission,
            driver_amount=driver_amount,
            already_paid=int(already_paid),
            in_processing=int(in_processing),
            available_balance=int(available_balance),
            eligible_bookings_ids=eligible_ids,
        )

    @staticmethod
    def validate_withdrawal(driver, requested_amount: int) -> tuple:
        """
        Valide qu un retrait est possible pour un conducteur.
        DOIT etre appele dans une transaction atomique avec select_for_update.

        Args:
            driver (User): Le conducteur
            requested_amount (int): Montant demande en XOF

        Returns:
            (bool, str, DriverEarningsSnapshot) : (valide, message_erreur, snapshot)
        """
        if requested_amount is None:
            return False, "Le montant est requis.", None

        try:
            requested_amount = int(requested_amount)
        except (ValueError, TypeError):
            return False, "Montant invalide.", None

        if requested_amount <= 0:
            return False, "Le montant doit etre superieur a zero.", None

        # Recalcul securise avec verrouillage
        snapshot = DriverEarningService.compute_balance(driver, lock=True)

        if requested_amount > snapshot.available_balance:
            return (
                False,
                f"Solde insuffisant. Disponible : {snapshot.available_balance} XOF, "
                f"Demande : {requested_amount} XOF.",
                snapshot
            )

        return True, None, snapshot

    @staticmethod
    def get_earnings_history(driver, limit: int = 50) -> list:
        """
        Retourne l historique des gains par trajet pour un conducteur.
        """
        from api.models.reservation import Booking
        from api.models.paiement import DriverPayout

        completed_rides_bookings = (
            Booking.objects
            .filter(
                ride__driver=driver,
                status='completed',
                payment_status__in=['escrow', 'paid']
            )
            .select_related('ride')
            .order_by('-ride__departure_date')
        )

        history = []
        seen_rides = {}

        for booking in completed_rides_bookings:
            ride = booking.ride
            ride_id = str(ride.id)

            if ride_id not in seen_rides:
                seen_rides[ride_id] = {
                    'ride_id': ride_id,
                    'departure_location': ride.departure_location,
                    'arrival_location': ride.arrival_location,
                    'departure_date': str(ride.departure_date),
                    'bookings_count': 0,
                    'gross_amount': 0,
                    'driver_amount': 0,
                    'zemy_commission': 0,
                    'payment_status': 'available',  # par defaut
                }
                history.append(seen_rides[ride_id])

            entry = seen_rides[ride_id]
            try:
                entry['bookings_count'] += 1
                entry['gross_amount'] += int(booking.total_amount)
                entry['driver_amount'] += int(booking.amount_due_to_driver)
                entry['zemy_commission'] += int(booking.zemy_commission)
            except Exception:
                pass

            # Statut du payout pour ce trajet
            if booking.payment_status == 'paid':
                entry['payment_status'] = 'paid'

        # Associer les payouts aux trajets
        payouts = DriverPayout.objects.filter(driver=driver).order_by('-requested_at')
        payout_by_ride = {}
        for payout in payouts:
            if payout.ride_id:
                ride_key = str(payout.ride_id)
                if ride_key not in payout_by_ride:
                    payout_by_ride[ride_key] = []
                payout_by_ride[ride_key].append({
                    'payout_id': str(payout.id),
                    'reference': payout.payout_reference,
                    'amount': payout.amount,
                    'status': payout.status,
                    'operator': payout.operator,
                    'phone_number': payout.phone_number,
                    'requested_at': payout.requested_at.isoformat() if payout.requested_at else None,
                    'paid_at': payout.paid_at.isoformat() if payout.paid_at else None,
                })

        for entry in history:
            entry['payouts'] = payout_by_ride.get(entry['ride_id'], [])

        return history[:limit]
