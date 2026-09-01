from rest_framework import viewsets, permissions
from rest_framework.response import Response
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
            return Vehicle.objects.all().order_by('-pk')
        return Vehicle.objects.filter(owner=user).order_by('-pk')

    def create(self, request, *args, **kwargs):
        # Eviter les créations de véhicules doublons pour un même conducteur :
        # Si le conducteur possède déjà un véhicule enregistré, on le met à jour via PATCH.
        license_plate = (request.data.get('license_plate') or '').strip()
        existing = Vehicle.objects.filter(owner=request.user)
        
        target = None
        if license_plate:
            target = existing.filter(license_plate__iexact=license_plate).first()
        if not target and existing.exists():
            target = existing.first()

        if target:
            serializer = self.get_serializer(target, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
