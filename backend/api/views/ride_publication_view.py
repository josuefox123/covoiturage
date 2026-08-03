from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..controllers.rides.ride_publication_controller import RidePublicationController
from ..serializers import RideSerializer

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def suggest_price_view(request):
    """Endpoint pour obtenir le prix suggéré d'un trajet selon la distance."""
    try:
        query_params = request.query_params if hasattr(request, 'query_params') else request.GET
        distance_km = float(query_params.get('distance_km', 0))
    except (ValueError, TypeError):
        return Response({'error': 'distance_km invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    if distance_km <= 0:
        return Response({'error': 'distance_km doit être un nombre positif.'}, status=status.HTTP_400_BAD_REQUEST)

    result = RidePublicationController.suggest_price(distance_km)
    return Response(result, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def publish_ride_view(request):
    """Endpoint unique pour publier un trajet simple ou récurrent."""
    is_recurrent = request.data.get('is_recurrent', False)

    if is_recurrent:
        result = RidePublicationController.publish_recurrent_rides(
            user=request.user,
            data=request.data
        )
        return Response(result, status=status.HTTP_201_CREATED)
    else:
        result = RidePublicationController.publish_ride(
            user=request.user,
            data=request.data,
            serializer_class=RideSerializer
        )
        return Response(result, status=status.HTTP_201_CREATED)
