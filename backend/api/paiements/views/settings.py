from rest_framework import viewsets, permissions
from ...models.paiement import FinancialSettings
from ...serializers import FinancialSettingsSerializer

class FinancialSettingsViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour configurer les taux de commission globaux de Zemy.
    """
    queryset = FinancialSettings.objects.all()
    serializer_class = FinancialSettingsSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        from ...models.paiement import FinancialSettings
        # Charger ou créer l'unique instance (singleton) des paramètres financiers
        FinancialSettings.load()
        return self.queryset.filter(pk=1)
