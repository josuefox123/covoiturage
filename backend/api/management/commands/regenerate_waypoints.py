"""
Commande de management Django pour régénérer les RideWaypoint
pour tous les trajets existants qui n'en ont pas encore.

Usage :
    python manage.py regenerate_waypoints
    python manage.py regenerate_waypoints --force  # Regénère même si waypoints existent
    python manage.py regenerate_waypoints --ride-id <uuid>  # Un seul trajet
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date
from api.models import Ride
from api.services.ride_service import RideService


class Command(BaseCommand):
    help = "Regénère les RideWaypoint pour les trajets existants (migration BlaBlaCar-like)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force la regénération même si les waypoints existent déjà',
        )
        parser.add_argument(
            '--ride-id',
            type=str,
            help='Regénère uniquement pour un trajet spécifique (UUID)',
        )
        parser.add_argument(
            '--future-only',
            action='store_true',
            help='Traite uniquement les trajets dont la date est >= aujourd\'hui',
        )

    def handle(self, *args, **options):
        force = options['force']
        ride_id = options.get('ride_id')
        future_only = options.get('future_only')

        qs = Ride.objects.prefetch_related('waypoints', 'legs')

        if ride_id:
            qs = qs.filter(id=ride_id)
            self.stdout.write(f"Mode: trajet unique {ride_id}")
        else:
            if future_only:
                qs = qs.filter(departure_date__gte=date.today())
                self.stdout.write("Mode: trajets futurs uniquement")
            else:
                self.stdout.write("Mode: tous les trajets")

        if not force:
            # Filtrer uniquement les trajets sans waypoints
            rides_without_waypoints = [r for r in qs if r.waypoints.count() == 0]
            total = len(rides_without_waypoints)
            self.stdout.write(f"Trajets sans waypoints : {total}")
            rides_to_process = rides_without_waypoints
        else:
            rides_to_process = list(qs)
            total = len(rides_to_process)
            self.stdout.write(f"Trajets à traiter (force=True) : {total}")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("Aucun trajet à traiter. ✓"))
            return

        success = 0
        errors = 0

        for i, ride in enumerate(rides_to_process, 1):
            try:
                self.stdout.write(
                    f"[{i}/{total}] Trajet {ride.id} ({ride.departure_location} → {ride.arrival_location}, {ride.departure_date})...",
                    ending=' '
                )
                RideService.generate_legs(ride)
                wp_count = ride.waypoints.count()
                self.stdout.write(self.style.SUCCESS(f"✓ {wp_count} waypoints"))
                success += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"✗ Erreur: {e}"))
                errors += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Terminé : {success} trajets traités avec succès, {errors} erreurs."
        ))
