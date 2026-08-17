from datetime import date
from django.db import transaction
from rest_framework.exceptions import ValidationError
from ..models import Booking, Ride, RideWaypoint
from ..services.ride_service import haversine_km

class BookingService:
    @staticmethod
    def create_booking(passenger, ride_id, seats_booked, departure_location=None, arrival_location=None,
                       departure_latitude=None, departure_longitude=None,
                       arrival_latitude=None, arrival_longitude=None,
                       passenger_proposed_price=None, negotiation_message=None,
                       departure_waypoint_order=None, arrival_waypoint_order=None):
        """
        Crée une réservation sécurisée à l'état initial 'pending'.
        Aucune place n'est décrémentée à ce stade.
        Le passager paye uniquement après accord du chauffeur.
        """
        if not passenger.is_verified:
            raise ValidationError({"error": "Votre compte doit être vérifié pour réserver."})

        with transaction.atomic():
            # Verrouiller le trajet pour éviter les lectures concurrentes incohérentes
            try:
                ride = Ride.objects.select_for_update().get(id=ride_id)
            except Ride.DoesNotExist:
                raise ValidationError({"error": "Trajet introuvable."})

            if ride.driver == passenger:
                raise ValidationError({"error": "Vous ne pouvez pas réserver votre propre trajet."})
                
            if ride.departure_date < date.today():
                raise ValidationError({"error": "Ce trajet est déjà passé (archivé)."})
                
            if ride.status in ['started', 'completed', 'cancelled']:
                raise ValidationError({"error": "Ce trajet n'est plus disponible pour la réservation."})

            # Vérifier s'il reste assez de places globalement
            if ride.seats_available < seats_booked:
                raise ValidationError({"error": "Nombre de places disponibles insuffisant."})

            # Trouver les index des waypoints de montée et descente
            wps = list(ride.waypoints.all().order_by('order')) if hasattr(ride, 'waypoints') else []
            if not wps and hasattr(ride, 'waypoints'):
                from ..services.ride_service import RideService
                try:
                    RideService.generate_legs(ride)
                    wps = list(ride.waypoints.all().order_by('order')) if hasattr(ride, 'waypoints') else []
                except Exception:
                    pass

            def clean_str(s):
                if not s: return ""
                return "".join(c for c in s.split(',')[0].strip().lower() if c.isalnum())

            dep_order = None
            arr_order = None

            # Si le frontend a passé directement les waypoint orders, on les utilise en priorité absolue
            if departure_waypoint_order is not None and arrival_waypoint_order is not None:
                try:
                    dep_order = int(departure_waypoint_order)
                    arr_order = int(arrival_waypoint_order)
                except (ValueError, TypeError):
                    pass

            # Sinon, résolution départ
            if dep_order is None:
                if departure_latitude is not None and departure_longitude is not None:
                    dep_wp = min(wps, key=lambda wp: haversine_km(wp.latitude, wp.longitude, float(departure_latitude), float(departure_longitude)))
                    dep_order = dep_wp.order
                elif departure_location:
                    dep_clean = clean_str(departure_location)
                    for wp in wps:
                        wp_clean = clean_str(wp.name)
                        if dep_clean and (dep_clean in wp_clean or wp_clean in dep_clean):
                            dep_order = wp.order
                            break
            
            # Sinon, résolution arrivée
            if arr_order is None:
                if arrival_latitude is not None and arrival_longitude is not None:
                    arr_wp = min(wps, key=lambda wp: haversine_km(wp.latitude, wp.longitude, float(arrival_latitude), float(arrival_longitude)))
                    arr_order = arr_wp.order
                elif arrival_location:
                    arr_clean = clean_str(arrival_location)
                    for wp in reversed(wps):
                        wp_clean = clean_str(wp.name)
                        if arr_clean and (arr_clean in wp_clean or wp_clean in arr_clean):
                            arr_order = wp.order
                            break

            # Fallbacks par défaut
            if dep_order is None:
                dep_order = 0
            if arr_order is None:
                arr_order = max(1, len(wps) - 1) if wps else 1

            if dep_order >= arr_order:
                if dep_order > 0:
                    dep_order, arr_order = arr_order, dep_order
                else:
                    arr_order = dep_order + 1

            # Vérifier la disponibilité par waypoint micro-segment
            segment_wps = [wp for wp in wps if dep_order <= wp.order < arr_order]
            if segment_wps:
                min_seats = min(wp.seats_available for wp in segment_wps)
            else:
                min_seats = ride.seats_available

            if min_seats < seats_booked:
                raise ValidationError({"error": "Nombre de places disponibles insuffisant sur ce segment de trajet."})

            # Vérifier si l'utilisateur a déjà une réservation ACTIVE pour CE SEGMENT PRÉCIS
            # (dep_order + arr_order sont déjà calculés plus haut)
            # Deux réservations sur le même ride mais des segments différents sont autorisées.
            existing_booking_same_segment = Booking.objects.filter(
                ride=ride,
                passenger=passenger,
                departure_waypoint_order=dep_order,
                arrival_waypoint_order=arr_order,
            ).exclude(status__in=['cancelled', 'payment_failed', 'expired']).first()

            if existing_booking_same_segment:
                # Même segment, même trajet : retourner l'existant
                if existing_booking_same_segment.status in ['pending_payment', 'pending', 'pending_passenger', 'pending_driver']:
                    return existing_booking_same_segment, False
                raise ValidationError({"error": "Vous avez déjà une réservation en cours pour ce segment de trajet."})

            # Vérifier aussi qu'il n'y a pas une réservation CONFIRMÉE sur ce même trajet
            # (on ne peut pas avoir deux réservations confirmées sur le même ride)
            existing_confirmed = Booking.objects.filter(
                ride=ride,
                passenger=passenger,
                status__in=['confirmed', 'started', 'payment_processing'],
            ).first()
            if existing_confirmed:
                raise ValidationError({"error": "Vous avez déjà une réservation confirmée sur ce trajet."})

            # Déterminer si c'est un trajet classique complet sans négociation
            is_classic = False
            if wps:
                last_idx = len(wps) - 1
                if dep_order == 0 and arr_order >= last_idx:
                    is_classic = True
            else:
                is_classic = True  # Fallback si aucun waypoint

            if passenger_proposed_price is not None or negotiation_message:
                is_classic = False

            # Résoudre les locations précises depuis les waypoints s'ils existent
            resolved_departure_location = departure_location
            resolved_arrival_location = arrival_location
            if wps:
                if dep_order is not None and dep_order < len(wps):
                    wp_dep_name = wps[dep_order].name
                    if not departure_location or (dep_order > 0 and departure_location == ride.departure_location):
                        resolved_departure_location = wp_dep_name or departure_location or ride.departure_location
                    else:
                        resolved_departure_location = departure_location

                if arr_order is not None and arr_order < len(wps):
                    wp_arr_name = wps[arr_order].name
                    if not arrival_location or (arr_order < len(wps) - 1 and arrival_location == ride.arrival_location):
                        resolved_arrival_location = wp_arr_name or arrival_location or ride.arrival_location
                    else:
                        resolved_arrival_location = arrival_location

            if not resolved_departure_location:
                resolved_departure_location = ride.departure_location
            if not resolved_arrival_location:
                resolved_arrival_location = ride.arrival_location

            initial_status = 'pending_payment'
            if passenger_proposed_price is not None or negotiation_message:
                initial_status = 'pending'

            # Créer la réservation à l'état initial
            booking = Booking.objects.create(
                ride=ride,
                passenger=passenger,
                seats_booked=seats_booked,
                status=initial_status,
                payment_status='pending',
                departure_location=resolved_departure_location,
                arrival_location=resolved_arrival_location,
                departure_latitude=departure_latitude,
                departure_longitude=departure_longitude,
                arrival_latitude=arrival_latitude,
                arrival_longitude=arrival_longitude,
                departure_waypoint_order=dep_order,
                arrival_waypoint_order=arr_order,
                passenger_proposed_price=passenger_proposed_price,
                negotiation_message=negotiation_message
            )
            
            # Planifier la tâche d'expiration automatique avec délai intelligent
            try:
                from django.utils import timezone
                import datetime
                now = timezone.now()
                ride_datetime = timezone.make_aware(
                    datetime.datetime.combine(ride.departure_date, ride.departure_time)
                )
                time_diff = ride_datetime - now
                diff_hours = time_diff.total_seconds() / 3600.0

                if diff_hours <= 0:
                    countdown_secs = 1800
                elif diff_hours <= 24:
                    countdown_secs = 1800
                elif diff_hours <= 48:
                    countdown_secs = 7200
                elif diff_hours <= 168:
                    countdown_secs = 43200
                else:
                    countdown_secs = 86400
            except Exception:
                countdown_secs = 86400

            try:
                import sys
                from ..tasks.expire_booking import expire_booking_task as _expire_task
                if 'test' not in sys.argv and hasattr(_expire_task, 'apply_async'):
                    _expire_task.apply_async((str(booking.id),), countdown=countdown_secs)  # type: ignore[union-attr]
                elif callable(_expire_task):
                    pass
            except Exception:
                pass

            return booking, True

    @staticmethod
    def get_legs_for_booking(ride, departure_location, arrival_location):
        """
        Retourne la liste des RideLeg concernés par la réservation.
        """
        legs = list(ride.legs.all().order_by('order'))
        if not legs:
            return []
        
        def clean_loc(l):
            if not l: return ""
            return "".join(c for c in l.split(',')[0].strip().lower() if c.isalnum())
            
        dep_clean = clean_loc(departure_location)
        arr_clean = clean_loc(arrival_location)
        
        if not dep_clean or not arr_clean:
            return legs
            
        start_idx = -1
        end_idx = -1
        
        for i, leg in enumerate(legs):
            leg_start = clean_loc(leg.start_location)
            if dep_clean in leg_start or leg_start in dep_clean:
                start_idx = i
                break
                
        for i, leg in enumerate(legs):
            leg_end = clean_loc(leg.end_location)
            if arr_clean in leg_end or leg_end in arr_clean:
                end_idx = i
                if start_idx != -1 and i >= start_idx:
                    break
                    
        if start_idx != -1 and end_idx != -1 and start_idx <= end_idx:
            return legs[start_idx:end_idx + 1]
            
        return legs

    @staticmethod
    def allocate_seats(booking):
        """
        Décrémente les places sur les segments concernés par la réservation.
        Retourne True si l'allocation est réussie, False sinon.
        """
        ride = booking.ride
        dep_order = booking.departure_waypoint_order
        arr_order = booking.arrival_waypoint_order
        
        if dep_order is None or arr_order is None:
            dep_order = 0
            wp_count = ride.waypoints.count() if hasattr(ride, 'waypoints') else 0
            arr_order = max(1, wp_count - 1)
            
        with transaction.atomic():
            # 1. Mettre à jour les micro-segments RideWaypoint
            wps = list(ride.waypoints.select_for_update().filter(order__gte=dep_order, order__lt=arr_order)) if hasattr(ride, 'waypoints') else []
            for wp in wps:
                if wp.seats_available < booking.seats_booked:
                    return False
            
            for wp in wps:
                wp.seats_available -= booking.seats_booked
                wp.save(update_fields=['seats_available'])
                
            # 2. Mettre à jour les legs macro pour la rétrocompatibilité (verrouillés)
            booked_legs = BookingService.get_legs_for_booking(ride, booking.departure_location, booking.arrival_location)
            if booked_legs:
                leg_ids = [lg.id for lg in booked_legs]
                locked_legs = list(ride.legs.select_for_update().filter(id__in=leg_ids))
                for leg in locked_legs:
                    leg.seats_available = max(0, leg.seats_available - booking.seats_booked)
                    leg.save(update_fields=['seats_available'])
                
            # 3. Mettre à jour la disponibilité globale du trajet (min de tous les waypoints)
            all_wps = list(ride.waypoints.all()) if hasattr(ride, 'waypoints') else []
            if all_wps:
                ride.seats_available = min(w.seats_available for w in all_wps)
            else:
                ride.seats_available = max(0, ride.seats_available - booking.seats_booked)
            ride.save(update_fields=['seats_available'])
            
            return True

    @staticmethod
    def deallocate_seats(booking):
        """
        Restitue les places sur les segments concernés par la réservation.
        """
        ride = booking.ride
        dep_order = booking.departure_waypoint_order
        arr_order = booking.arrival_waypoint_order
        
        if dep_order is None or arr_order is None:
            dep_order = 0
            wp_count = ride.waypoints.count() if hasattr(ride, 'waypoints') else 0
            arr_order = max(1, wp_count - 1)
            
        with transaction.atomic():
            # 1. Ré-incrémenter sur les waypoints
            wps = list(ride.waypoints.select_for_update().filter(order__gte=dep_order, order__lt=arr_order)) if hasattr(ride, 'waypoints') else []
            for wp in wps:
                wp.seats_available += booking.seats_booked
                wp.save(update_fields=['seats_available'])
                
            # 2. Ré-incrémenter sur les legs (verrouillés)
            booked_legs = BookingService.get_legs_for_booking(ride, booking.departure_location, booking.arrival_location)
            if booked_legs:
                leg_ids = [lg.id for lg in booked_legs]
                locked_legs = list(ride.legs.select_for_update().filter(id__in=leg_ids))
                for leg in locked_legs:
                    leg.seats_available += booking.seats_booked
                    leg.save(update_fields=['seats_available'])
                
            # 3. Ré-calculer la dispo globale
            all_wps = list(ride.waypoints.all()) if hasattr(ride, 'waypoints') else []
            if all_wps:
                ride.seats_available = min(w.seats_available for w in all_wps)
            else:
                ride.seats_available += booking.seats_booked
            ride.save(update_fields=['seats_available'])


