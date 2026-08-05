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
                                title="Demande de réservation expirée ⏱️",
                                message=f"Votre demande de réservation pour le trajet {dep_loc} -> {arr_loc} a expiré car l'heure de départ est dépassée.",
                                data={'type': 'booking_expired', 'booking_id': str(pb.id), 'screen': 'trips'}
                            )
                        except Exception as ne:
                            logger.error(f"[Cleanup] Erreur notification expiration passager {pb.id}: {ne}")

                        # Notifier le conducteur
                        try:
                            create_and_send_notification(
                                user=ride.driver,
                                title="Demande expirée ⏱️",
                                message=f"La demande de réservation de {pb.passenger.full_name or pb.passenger.phone} ({dep_loc} -> {arr_loc}) a expiré car l'heure de départ du trajet est dépassée.",
                                data={'type': 'booking_expired_driver', 'booking_id': str(pb.id), 'screen': 'rides'}
                            )
                        except Exception as ne2:
                            logger.error(f"[Cleanup] Erreur notification expiration conducteur {pb.id}: {ne2}")

                        logger.info(f"[Cleanup] Réservation {pb.id} passée en 'expired' car le trajet {ride.id} est passé.")
                except Exception as e:
                    logger.error(f"[Cleanup] Erreur lors de l'expiration automatique de la réservation {pb.id}: {e}")

            # ==========================================
            # 2. Alertes de départ imminent
            # ==========================================
            # Chercher les trajets actifs partant dans une fenêtre de 20 à 40 minutes à partir de maintenant
            start_range = now + timedelta(minutes=20)
            end_range = now + timedelta(minutes=40)
            
            upcoming_rides = Ride.objects.filter(
                status='active',
                departure_date=now.date(),
                departure_time__range=(start_range.time(), end_range.time())
            )
            
            for ride in upcoming_rides:
                # 1. Alerte Conducteur
                has_driver_notified = Notification.objects.filter(
                    user=ride.driver,
                    title="Départ dans 30 min ⏰",
                    message__contains=ride.departure_location
                ).exists()
                
                if not has_driver_notified:
                    create_and_send_notification(
                        user=ride.driver,
                        title="Départ dans 30 min ⏰",
                        message=f"Rappel : Votre trajet {ride.departure_location} -> {ride.arrival_location} commence dans environ 30 minutes. Préparez-vous !",
                        data={'type': 'departure_warning_driver', 'ride_id': str(ride.id), 'screen': 'trips'}
                    )
                
                # 2. Alerte Passagers confirmés
                bookings = Booking.objects.filter(ride=ride, status='confirmed')
                for booking in bookings:
                    b_dep = booking.departure_location or ride.departure_location or ''
                    b_arr = booking.arrival_location or ride.arrival_location or ''
                    has_passenger_notified = Notification.objects.filter(
                        user=booking.passenger,
                        title="Départ dans 30 min ⏰",
                        message__contains=b_dep
                    ).exists()
                    
                    if not has_passenger_notified:
                        create_and_send_notification(
                            user=booking.passenger,
                            title="Départ dans 30 min ⏰",
                            message=f"Rappel : Votre départ pour le trajet {b_dep} -> {b_arr} est prévu dans environ 30 minutes !",
                            data={'type': 'departure_warning_passenger', 'booking_id': str(booking.id), 'screen': 'trips'}
                        )
                        
        except Exception as e:
            logger.error(f"[Departure Check] Erreur : {e}")
            
        # Revérifier toutes les 10 secondes
        time.sleep(10)

def start_departure_check_thread():
    thread = threading.Thread(target=check_upcoming_departures, daemon=True)
    thread.start()
