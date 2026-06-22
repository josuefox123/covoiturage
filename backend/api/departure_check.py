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
            from api.models import Ride, Booking, Notification
            from api.fcm import create_and_send_notification
            
            now = datetime.now()
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
                    message__contains=str(ride.id)
                ).exists()
                
                if not has_driver_notified:
                    create_and_send_notification(
                        user=ride.driver,
                        title="Départ dans 30 min ⏰",
                        message=f"Rappel : Votre trajet {ride.departure_location} -> {ride.arrival_location} (ID: {ride.id}) commence dans environ 30 minutes. Préparez-vous !",
                        data={'type': 'departure_warning_driver', 'ride_id': str(ride.id), 'screen': 'trips'}
                    )
                
                # 2. Alerte Passagers confirmés
                bookings = ride.bookings.filter(status='confirmed')
                for booking in bookings:
                    has_passenger_notified = Notification.objects.filter(
                        user=booking.passenger,
                        title="Départ dans 30 min ⏰",
                        message__contains=str(ride.id)
                    ).exists()
                    
                    if not has_passenger_notified:
                        create_and_send_notification(
                            user=booking.passenger,
                            title="Départ dans 30 min ⏰",
                            message=f"Rappel : Votre départ pour le trajet {ride.departure_location} -> {ride.arrival_location} (ID: {ride.id}) est prévu dans environ 30 minutes !",
                            data={'type': 'departure_warning_passenger', 'booking_id': str(booking.id), 'screen': 'trips'}
                        )
                        
        except Exception as e:
            logger.error(f"[Departure Check] Erreur : {e}")
            
        # Revérifier toutes les 2 minutes
        time.sleep(120)

def start_departure_check_thread():
    thread = threading.Thread(target=check_upcoming_departures, daemon=True)
    thread.start()
