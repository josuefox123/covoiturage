"""
========================================================

Fichier :
departure_check.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
import threading
import time
import os
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def check_upcoming_departures():
    # Attendre que Django soit complètement démarré
    time.sleep(10)
    logger.info("[Departure Check] Le thread de vérification des départs a démarré.")
    while True:
        try:
            from api.models import Ride, Booking, Notification, Parcel
            from api.fcm import create_and_send_notification
            from django.utils import timezone
            from django.db import transaction
            
            now = timezone.now()
            
            # ==========================================
            # 1. Nettoyage des réservations non payées (> 30 minutes)
            # ==========================================
            expired_time = now - timedelta(minutes=30)
            
            # Nettoyer les réservations de passagers (uniquement celles en attente de paiement 'pending_payment')
            expired_bookings = Booking.objects.filter(
                payment_status='pending',
                status='pending_payment',
                created_at__lt=expired_time
            )
            for eb in expired_bookings:
                try:
                    eb.delete()
                    logger.info(f"[Cleanup] Réservation passager expirée supprimée (ID: {eb.id}).")
                except Exception as e:
                    logger.error(f"[Cleanup] Erreur lors de la suppression de la réservation {eb.id}: {e}")

            # Nettoyer les réservations de colis (donner 30 minutes pour payer également)
            expired_parcels = Parcel.objects.filter(payment_status='pending', created_at__lt=expired_time)
            for ep in expired_parcels:
                try:
                    ep.delete()
                    logger.info(f"[Cleanup] Réservation colis expirée supprimée (ID: {ep.id}).")
                except Exception as e:
                    logger.error(f"[Cleanup] Erreur lors de la suppression du colis {ep.id}: {e}")

            # ==========================================
            # 1b. Expiration des demandes de réservation pour les trajets passés (heure de départ dépassée)
            # ==========================================
            import datetime
            active_pending_bookings = Booking.objects.filter(
                status__in=['pending', 'pending_driver', 'pending_passenger', 'pending_payment']
            )
            for pb in active_pending_bookings:
                try:
                    ride = pb.ride
                    ride_datetime = timezone.make_aware(
                        datetime.datetime.combine(ride.departure_date, ride.departure_time)
                    )
                    # Si l'heure de départ du trajet est passée depuis plus de 5 minutes
                    if now > ride_datetime + datetime.timedelta(minutes=5):
                        old_status = pb.status
                        pb.status = 'expired'
                        pb.save()
                        
                        # Notifier via WebSockets
                        try:
                            from api.websocket.handlers import push_booking_update
                            push_booking_update(pb)
                        except Exception as wse:
                            logger.error(f"[Cleanup] Erreur push WS pour expiration {pb.id}: {wse}")

                        dep_loc = pb.departure_location or ride.departure_location or ''
                        arr_loc = pb.arrival_location or ride.arrival_location or ''
                        # Notifier le passager
                        try:
                            create_and_send_notification(
                                user=pb.passenger,
                                title="Demande de réservation expirée",
                                message=f"Votre demande de réservation pour le trajet {dep_loc} -> {arr_loc} a expiré car l'heure de départ est dépassée.",
                                data={'type': 'booking_expired', 'booking_id': str(pb.id), 'screen': 'trips'}
                            )
                        except Exception as ne:
                            logger.error(f"[Cleanup] Erreur notification expiration passager {pb.id}: {ne}")

                        # Notifier le conducteur
                        try:
                            create_and_send_notification(
                                user=ride.driver,
                                title="Demande expirée",
                                message=f"La demande de réservation de {pb.passenger.full_name or pb.passenger.phone} ({dep_loc} -> {arr_loc}) a expiré car l'heure de départ du trajet est dépassée.",
                                data={'type': 'booking_expired_driver', 'booking_id': str(pb.id), 'screen': 'rides'}
                            )
                        except Exception as ne2:
                            logger.error(f"[Cleanup] Erreur notification expiration conducteur {pb.id}: {ne2}")

                        logger.info(f"[Cleanup] Réservation {pb.id} passée en 'expired' car le trajet {ride.id} est passé.")
                except Exception as e:
                    logger.error(f"[Cleanup] Erreur lors de l'expiration automatique de la réservation {pb.id}: {e}")

            # ==========================================
            # 2. ALERTE DE CONFIRMATION CONDUCTEUR (T-30 min)
            # ==========================================
            # Chercher les trajets actifs partant dans une fenêtre de 28 à 35 minutes
            # dont l'alerte de confirmation n'a pas encore été envoyée
            confirm_start = now + timedelta(minutes=28)
            confirm_end   = now + timedelta(minutes=35)

            rides_needing_confirm = Ride.objects.filter(
                status='active',
                departure_date=now.date(),
                departure_time__range=(confirm_start.time(), confirm_end.time()),
                departure_confirmation_sent_at__isnull=True,   # pas encore envoyé
            )

            for ride in rides_needing_confirm:
                try:
                    dep = ride.departure_location or ''
                    arr = ride.arrival_location or ''

                    # Marquer comme envoyé AVANT d'envoyer (évite les doublons)
                    ride.departure_confirmation_sent_at = now
                    ride.save(update_fields=['departure_confirmation_sent_at'])

                    create_and_send_notification(
                        user=ride.driver,
                        title="VOTRE TRAJET PART DANS 30 MIN",
                        message=(
                            f"Votre trajet {dep} → {arr} démarre dans environ 30 minutes.\n\n"
                            f"Le trajet tient-il toujours ?\n\n"
                            f"• Si OUI → confirmez pour que vos passagers soient avertis.\n"
                            f"• Si NON → annulez maintenant pour que vos passagers soient remboursés.\n\n"
                            f"Sans réponse de votre part dans 10 minutes, le trajet sera automatiquement annulé."
                        ),
                        data={
                            'type': 'departure_confirmation_required',
                            'ride_id': str(ride.id),
                            'screen': 'rides',
                            'requires_acknowledgment': 'true',
                            'urgent': 'true',
                        }
                    )
                    logger.info(f"[DepartureCheck] Alerte de confirmation envoyée au conducteur du trajet {ride.id}")
                except Exception as e:
                    logger.error(f"[DepartureCheck] Erreur alerte confirmation trajet {ride.id}: {e}")

            # ==========================================
            # 3. ANNULATION AUTOMATIQUE si pas de réponse à T-20 min
            # ==========================================
            # Chercher les trajets actifs qui :
            #   - partent dans 18 à 22 min
            #   - ont reçu l'alerte (departure_confirmation_sent_at not null)
            #   - n'ont pas encore de réponse (driver_confirmed_departure is None)
            auto_cancel_start = now + timedelta(minutes=18)
            auto_cancel_end   = now + timedelta(minutes=22)

            rides_no_response = Ride.objects.filter(
                status='active',
                departure_date=now.date(),
                departure_time__range=(auto_cancel_start.time(), auto_cancel_end.time()),
                departure_confirmation_sent_at__isnull=False,
                driver_confirmed_departure__isnull=True,
            )

            for ride in rides_no_response:
                try:
                    dep = ride.departure_location or ''
                    arr = ride.arrival_location or ''
                    driver_name = ride.driver.full_name or ride.driver.phone or 'Le conducteur'

                    # Marquer comme annulé par absence de réponse
                    with transaction.atomic():
                        ride.status = 'cancelled'
                        ride.driver_confirmed_departure = False
                        ride.save(update_fields=['status', 'driver_confirmed_departure'])

                        # Rembourser tous les passagers confirmés
                        from api.models.paiement import RefundRequest as RF
                        confirmed_bookings = ride.bookings.filter(status='confirmed', payment_status='escrow')
                        from django.db.models import F
                        refund_count = 0
                        for booking in confirmed_bookings:
                            booking.status = 'cancelled'
                            booking.payment_status = 'refunded'
                            booking.save(update_fields=['status', 'payment_status'])

                            ride.seats_available = F('seats_available') + booking.seats_booked
                            ride.save(update_fields=['seats_available'])

                            amount_to_refund = booking.total_amount
                            RF.objects.create(
                                booking=booking,
                                passenger=booking.passenger,
                                driver=ride.driver,
                                amount=amount_to_refund,
                                reason=f"Annulation automatique — conducteur n'a pas confirmé le trajet {dep} → {arr}",
                                status='approved'
                            )
                            refund_count += 1

                            b_dep = booking.departure_location or dep
                            b_arr = booking.arrival_location or arr
                            create_and_send_notification(
                                user=booking.passenger,
                                title="Trajet annulé - Remboursement en cours",
                                message=(
                                    f"Trajet annulé - {b_dep} -> {b_arr}\n\n"
                                    f"{driver_name} n'a pas confirmé ce trajet à temps. "
                                    f"Pour votre sécurité, il a été annulé automatiquement.\n"
                                    f"Toutes nos excuses pour la gêne occasionnée. "
                                    f"Votre remboursement de {amount_to_refund} FCFA est en cours (24–48h). "
                                    f"L'équipe Zemy reste disponible pour vous trouver un autre trajet."
                                ),
                                data={
                                    'type': 'ride_cancelled_no_driver_response',
                                    'booking_id': str(booking.id),
                                    'ride_id': str(ride.id),
                                    'screen': 'trips',
                                    'requires_acknowledgment': 'true',
                                }
                            )

                        # Notifier le conducteur de l'annulation automatique
                        create_and_send_notification(
                            user=ride.driver,
                            title="Trajet annulé automatiquement",
                            message=(
                                f"Votre trajet {dep} → {arr} a été annulé automatiquement car "
                                f"vous n'avez pas répondu à l'alerte de confirmation dans les délais. "
                                f"{refund_count} passager(s) ont été remboursés."
                            ),
                            data={
                                'type': 'driver_no_response_auto_cancel',
                                'ride_id': str(ride.id),
                                'screen': 'rides',
                            }
                        )
                        logger.info(f"[DepartureCheck] Trajet {ride.id} annulé automatiquement (pas de réponse conducteur). {refund_count} remboursements.")
                except Exception as e:
                    logger.error(f"[DepartureCheck] Erreur annulation automatique trajet {ride.id}: {e}")

            # ==========================================
            # 4. FENÊTRE DE DÉMARRAGE (T-10 min) pour les trajets confirmés
            # ==========================================
            # Chercher les trajets confirmés (driver_confirmed_departure=True) qui partent
            # dans 8 à 12 min et pour lesquels on n'a pas encore envoyé la notif de démarrage
            start_window_start = now + timedelta(minutes=8)
            start_window_end   = now + timedelta(minutes=12)

            rides_start_window = Ride.objects.filter(
                status='active',
                departure_date=now.date(),
                departure_time__range=(start_window_start.time(), start_window_end.time()),
                driver_confirmed_departure=True,
            ).exclude(
                # Exclure ceux qui ont déjà reçu cette notification
                driver__notifications__type='departure_start_window',
                driver__notifications__data__ride_id=None  # filtre sera fait via Python
            )

            for ride in rides_start_window:
                try:
                    # Vérifier si la notif de démarrage a déjà été envoyée (évite les doublons)
                    from api.models import Notification
                    already_sent = Notification.objects.filter(
                        user=ride.driver,
                        type='departure_start_window',
                        data__ride_id=str(ride.id)
                    ).exists()

                    if not already_sent:
                        dep = ride.departure_location or ''
                        arr = ride.arrival_location or ''
                        create_and_send_notification(
                            user=ride.driver,
                            title="C'est l'heure - Démarrez votre trajet",
                            message=(
                                f"Votre trajet {dep} → {arr} démarre dans ~10 minutes. "
                                f"Rendez-vous au point de départ et démarrez le live depuis l'application."
                            ),
                            data={
                                'type': 'departure_start_window',
                                'ride_id': str(ride.id),
                                'screen': 'rides',
                            }
                        )

                        # Notifier aussi les passagers que le conducteur est en route
                        confirmed_bookings = ride.bookings.filter(status='confirmed')
                        for booking in confirmed_bookings:
                            b_dep = booking.departure_location or dep
                            b_arr = booking.arrival_location or arr
                            create_and_send_notification(
                                user=booking.passenger,
                                title="Votre conducteur arrive !",
                                message=(
                                    f"Votre trajet {b_dep} → {b_arr} démarre dans environ 10 minutes. "
                                    f"Rendez-vous au point de départ !"
                                ),
                                data={
                                    'type': 'departure_imminent_passenger',
                                    'booking_id': str(booking.id),
                                    'ride_id': str(ride.id),
                                    'screen': 'trips',
                                }
                            )
                        logger.info(f"[DepartureCheck] Fenêtre de démarrage envoyée pour le trajet {ride.id}")
                except Exception as e:
                    logger.error(f"[DepartureCheck] Erreur fenêtre démarrage trajet {ride.id}: {e}")

        except Exception as e:
            logger.error(f"[Departure Check] Erreur : {e}")
            
        # Revérifier toutes les 10 secondes
        time.sleep(10)

def start_departure_check_thread():
    thread = threading.Thread(target=check_upcoming_departures, daemon=True)
    thread.start()
