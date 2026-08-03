from rest_framework import viewsets, permissions
from ...models.utilisateur import Vehicle
from ...serializers import VehicleSerializer

class VehicleViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des véhicules des conducteurs.
    """
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Vehicle.objects.none()

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'is_staff', False):
            return Vehicle.objects.all()
        return Vehicle.objects.filter(owner=user)
