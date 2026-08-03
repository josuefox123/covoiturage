from datetime import date, time, datetime
from typing import List, Optional

class ReglesPublicationDomain:
    """Règles métier globales pour la validation temporelle de publication de trajets."""

    @staticmethod
    def valider_parametres_recurrence(
        start_date: date,
        end_date: date,
        repeat_type: str,
        week_days: List[int]
    ) -> Optional[str]:
        """
        Valide la cohérence des paramètres d'un trajet récurrent.
        Retourne un message d'erreur si invalide, sinon None.
        """
        if end_date < start_date:
            return "La date de fin ne peut pas être antérieure à la date de début."
            
        if repeat_type == 'weekly' and not week_days:
            return "Veuillez sélectionner au moins un jour pour la récurrence."
            
        return None

    @staticmethod
    def determiner_jours_recurrence(
        start_date: date,
        end_date: date,
        repeat_type: str,
        week_days: List[int]
    ) -> List[date]:
        """Retourne la liste des dates d'exécution basées sur les critères de récurrence."""
        dates = []
        from datetime import timedelta
        current_date = start_date
        while current_date <= end_date:
            if repeat_type == 'daily':
                dates.append(current_date)
            elif repeat_type == 'weekly':
                if current_date.weekday() in week_days:
                    dates.append(current_date)
            current_date += timedelta(days=1)
        return dates
