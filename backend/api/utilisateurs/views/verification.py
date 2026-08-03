from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from ...models.utilisateur import VerificationRequest, Notification
from ...serializers import VerificationRequestSerializer
from ...fcm import send_fcm_to_user

class VerificationRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour soumettre et gérer les demandes de vérification d'identité (CNI, Selfie).
    """
    queryset = VerificationRequest.objects.all().order_by('-created_at')
    serializer_class = VerificationRequestSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        req = self.get_object()
        motif = request.data.get('motif', '').strip()
        req.status = 'approved'
        req.save()

        req.user.is_verified = True
        req.user.save(update_fields=['is_verified'])

        msg = "Votre demande de vérification d'identité a été approuvée. Vous pouvez maintenant utiliser toutes les fonctionnalités de l'application !"
        if motif:
            msg += f"\n\nMotif : {motif}"
        Notification.objects.create(
            user=req.user,
            title="Identité vérifiée ✅",
            message=msg,
            is_read=False,
        )
        send_fcm_to_user(
            req.user,
            title="Identité vérifiée ✅",
            body="Votre demande de vérification a été approuvée !",
            data={'type': 'verification_approved', 'screen': 'notifications'},
        )
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        req = self.get_object()
        motif = request.data.get('motif', '').strip()
        req.status = 'rejected'
        req.save()

        msg = "Votre demande de vérification d'identité a été rejetée."
        if motif:
            msg += f"\n\nMotif : {motif}"
        else:
            msg += " Veuillez vérifier que vos documents sont lisibles et soumettre à nouveau."
        Notification.objects.create(
            user=req.user,
            title="Vérification rejetée ❌",
            message=msg,
            is_read=False,
        )
        send_fcm_to_user(
            req.user,
            title="Vérification rejetée ❌",
            body="Votre demande de vérification a été rejetée. Vérifiez vos documents.",
            data={'type': 'verification_rejected', 'screen': 'notifications'},
        )
        return Response({'status': 'rejected'})

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Vérification des comptes'])
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def request_verification(request):
    """
    Le passager soumet une demande de vérification d'identité avec images.
    """
    user = request.user
    if user.is_verified:
        return Response({'message': 'Votre compte est déjà vérifié.'}, status=status.HTTP_200_OK)

    existing = VerificationRequest.objects.filter(user=user).first()
    if existing and existing.status == 'pending':
        return Response({'error': 'Une demande est déjà en cours de traitement.'}, status=status.HTTP_400_BAD_REQUEST)

    selfie = request.FILES.get('selfie')
    selfie_id = request.FILES.get('selfie_id')
    id_front = request.FILES.get('id_front')
    id_back = request.FILES.get('id_back')

    if not all([selfie, selfie_id, id_front, id_back]):
        return Response({'error': 'Tous les documents (selfie, selfie avec carte, recto, verso) sont requis.'}, status=status.HTTP_400_BAD_REQUEST)

    user.avatar = selfie
    user.save(update_fields=['avatar'])

    VerificationRequest.objects.update_or_create(
        user=user,
        defaults={
            'selfie': selfie,
            'selfie_id': selfie_id,
            'id_front': id_front,
            'id_back': id_back,
            'status': 'pending'
        }
    )

    return Response({
        'message': 'Votre demande de vérification a été envoyée avec succès.'
    }, status=status.HTTP_200_OK)

@extend_schema(responses={200: dict}, tags=['Vérification des comptes'])
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def verification_status(request):
    """
    Retourne le statut de la demande de vérification de l'utilisateur connecté.
    """
    user = request.user
    if user.is_verified:
        return Response({'status': 'approved', 'is_verified': True})
    existing = VerificationRequest.objects.filter(user=user).first()
    if existing:
        return Response({'status': existing.status, 'is_verified': False})
    return Response({'status': 'none', 'is_verified': False})
