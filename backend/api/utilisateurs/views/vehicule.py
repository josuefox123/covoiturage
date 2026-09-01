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

    def perform_create(self, serializer):
        # BUG-009 FIX : Forcer owner = utilisateur connecté pour éviter le Mass Assignment IDOR.
        # 'owner' est déclaré read_only dans VehicleSerializer, donc le frontend ne peut pas
        # imposer un owner différent, mais on le force ici par sécurité défensive.
        serializer.save(owner=self.request.user)
