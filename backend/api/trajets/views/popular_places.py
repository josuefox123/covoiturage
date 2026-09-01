from rest_framework import viewsets, permissions
from django.db.models import Q
from ...models.parametres import PopularPlace
from ...serializers import PopularPlaceSerializer

class PopularPlaceViewSet(viewsets.ModelViewSet):
    queryset = PopularPlace.objects.all()
    serializer_class = PopularPlaceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        query_params = getattr(self.request, 'query_params', None) or getattr(self.request, 'GET', {})
        search = query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(city__icontains=search)
            )
        return queryset
