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
            # 2. Alertes de départ (Veille J-1, H-30min, et H-0 Heure Pile)
            # ==========================================
            # Récupérer tous les trajets actifs pour vérifier l'écart exact en minutes
            # (Prend en compte la date et l'heure en datetime conscient du fuseau horaire)
            active_rides = Ride.objects.filter(status='active').select_related('driver')
            
            for ride in active_rides:
                try:
                    if not ride.departure_date or not ride.departure_time:
                        continue
                    
                    # Construction du datetime local de départ
                    dep_naive = datetime.combine(ride.departure_date, ride.departure_time)
                    dep_aware = timezone.make_aware(dep_naive, timezone.get_current_timezone())
                    
                    # Écart en minutes (positif si dans le futur, négatif si passé)
                    diff_minutes = (dep_aware - now).total_seconds() / 60.0
                    
                    # --- A. RAPPEL LA VEILLE (J-1 : entre 18h et 30h avant le départ) ---
                    if 18 * 60 <= diff_minutes <= 30 * 60:
                        # 1. Driver J-1
                        has_driver_notified = Notification.objects.filter(
                            user=ride.driver,
                            type='departure_tomorrow',
                            data__ride_id=str(ride.id)
                        ).exists()
                        
                        if not has_driver_notified:
                            create_and_send_notification(
                                user=ride.driver,
                                title="Trajet prévu demain",
                                message=f"Rappel : Votre trajet {ride.departure_location} -> {ride.arrival_location} est prévu demain à {ride.departure_time.strftime('%H:%M')}.",
                                data={'type': 'departure_tomorrow', 'ride_id': str(ride.id), 'screen': 'trips'}
                            )
                        
                        # 2. Passagers confirmés J-1
                        bookings = Booking.objects.filter(ride=ride, status='confirmed').select_related('passenger')
                        for booking in bookings:
                            b_dep = booking.departure_location or ride.departure_location or ''
                            b_arr = booking.arrival_location or ride.arrival_location or ''
                            has_pax_notified = Notification.objects.filter(
                                user=booking.passenger,
                                type='departure_tomorrow',
                                data__booking_id=str(booking.id)
                            ).exists()
                            
                            if not has_pax_notified:
                                create_and_send_notification(
                                    user=booking.passenger,
                                    title="Trajet prévu demain",
                                    message=f"Rappel : Votre trajet {b_dep} -> {b_arr} est prévu demain à {ride.departure_time.strftime('%H:%M')}.",
                                    data={'type': 'departure_tomorrow', 'booking_id': str(booking.id), 'screen': 'trips'}
                                )

                    # --- B. RAPPEL 30 MINUTES AVANT (H-30m : départ dans 5 à 45 minutes) ---
                    if 5 <= diff_minutes <= 45:
                        # 1. Driver 30m
                        has_driver_notified = Notification.objects.filter(
                            user=ride.driver,
                            type='departure_warning_30m',
                            data__ride_id=str(ride.id)
                        ).exists()
                        
                        if not has_driver_notified:
                            create_and_send_notification(
                                user=ride.driver,
                                title="Départ dans 30 min",
                                message=f"Rappel : Votre trajet {ride.departure_location} -> {ride.arrival_location} commence dans environ 30 minutes. Préparez-vous !",
                                data={'type': 'departure_warning_30m', 'ride_id': str(ride.id), 'screen': 'trips'}
                            )
                        
                        # 2. Passagers 30m
                        bookings = Booking.objects.filter(ride=ride, status='confirmed').select_related('passenger')
                        for booking in bookings:
                            b_dep = booking.departure_location or ride.departure_location or ''
                            b_arr = booking.arrival_location or ride.arrival_location or ''
                            has_pax_notified = Notification.objects.filter(
                                user=booking.passenger,
                                type='departure_warning_30m',
                                data__booking_id=str(booking.id)
                            ).exists()
                            
                            if not has_pax_notified:
                                create_and_send_notification(
                                    user=booking.passenger,
                                    title="Départ dans 30 min",
                                    message=f"Rappel : Votre départ pour le trajet {b_dep} -> {b_arr} est prévu dans environ 30 minutes !",
                                    data={'type': 'departure_warning_30m', 'booking_id': str(booking.id), 'screen': 'trips'}
                                )

                    # --- C. RAPPEL HEURE PILE (H-0 : départ entre -5 min et +10 min) ---
                    if -5 <= diff_minutes <= 10:
                        # 1. Driver H-0
                        has_driver_notified = Notification.objects.filter(
                            user=ride.driver,
                            type='departure_now',
                            data__ride_id=str(ride.id)
                        ).exists()
                        
                        if not has_driver_notified:
                            create_and_send_notification(
                                user=ride.driver,
                                title="C'est l'heure du départ !",
                                message=f"C'est l'heure ! Votre trajet {ride.departure_location} -> {ride.arrival_location} commence maintenant. N'oubliez pas de démarrer le trajet dans l'application.",
                                data={'type': 'departure_now', 'ride_id': str(ride.id), 'screen': 'trips'}
                            )
                        
                        # 2. Passagers H-0
                        bookings = Booking.objects.filter(ride=ride, status='confirmed').select_related('passenger')
                        for booking in bookings:
                            b_dep = booking.departure_location or ride.departure_location or ''
                            b_arr = booking.arrival_location or ride.arrival_location or ''
                            has_pax_notified = Notification.objects.filter(
                                user=booking.passenger,
                                type='departure_now',
                                data__booking_id=str(booking.id)
                            ).exists()
                            
                            if not has_pax_notified:
                                create_and_send_notification(
                                    user=booking.passenger,
                                    title="C'est l'heure du départ !",
                                    message=f"C'est l'heure ! Votre trajet {b_dep} -> {b_arr} commence maintenant. Préparez-vous à embarquer !",
                                    data={'type': 'departure_now', 'booking_id': str(booking.id), 'screen': 'trips'}
                                )

                except Exception as ride_err:
                    logger.error(f"[Departure Check] Erreur traitement trajet {getattr(ride, 'id', None)}: {ride_err}")
                        
        except Exception as e:
            logger.error(f"[Departure Check] Erreur : {e}")
            
        # Revérifier toutes les 10 secondes
        time.sleep(10)

def start_departure_check_thread():
    thread = threading.Thread(target=check_upcoming_departures, daemon=True)
    thread.start()
