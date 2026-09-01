from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
import secrets

from ...models.utilisateur import User, UserPreference
from ...models.parametres import AuditLog
from ...serializers import UserSerializer, AdminUserSerializer, UserPreferenceSerializer
from ...fcm import create_and_send_notification

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet permettant de gérer les utilisateurs (CRUD).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.user and getattr(self.request.user, 'is_staff', False):
            return AdminUserSerializer
        return UserSerializer

    def perform_update(self, serializer):
        # Pour les utilisateurs non-administrateurs, on bloque la modification de champs de privilège ou de réputation
        if not getattr(self.request.user, 'is_staff', False):
            serializer.save(
                is_staff=serializer.instance.is_staff,
                is_superuser=serializer.instance.is_superuser,
                is_verified=serializer.instance.is_verified,
                is_active=serializer.instance.is_active,
                is_archived=serializer.instance.is_archived,
                rating=serializer.instance.rating,
            )
        else:
            serializer.save()

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and getattr(user, 'is_staff', False):
            if self.action == 'list':
                qs = User.objects.filter(is_archived=False)
                query_params = getattr(self.request, 'query_params', None) or getattr(self.request, 'GET', {})
                is_staff_param = query_params.get('is_staff')
                if is_staff_param == 'true':
                    qs = qs.filter(is_staff=True)
                elif is_staff_param == 'false':
                    qs = qs.filter(is_staff=False)
                return qs.order_by('-created_at')
            return User.objects.all().order_by('-created_at')
        if user.is_authenticated:
            return User.objects.filter(id=user.id, is_archived=False)
        return User.objects.none()

    @action(detail=False, methods=['post'], url_path='create-admin', permission_classes=[permissions.IsAdminUser])
    def create_admin(self, request):
        full_name = request.data.get('full_name')
        email = request.data.get('email')
        phone = request.data.get('phone')

        if not email or not full_name:
            return Response({"error": "Nom et email sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(email=email).exists():
            return Response({"error": "Un utilisateur avec cet email existe déjà."}, status=status.HTTP_400_BAD_REQUEST)
        
        if phone and User.objects.filter(phone=phone).exists():
            return Response({"error": "Un utilisateur avec ce téléphone existe déjà."}, status=status.HTTP_400_BAD_REQUEST)

        password = secrets.token_hex(6)
        
        with transaction.atomic():
            user = User.objects.create(
                email=email,
                full_name=full_name,
                phone=phone,
                is_staff=True,
                is_active=True,
                is_verified=True
            )
            user.set_password(password)
            user.save()
            
            from django.core.mail import EmailMultiAlternatives
            from django.conf import settings
            subject = "Création de votre compte Administrateur Zemy"
            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; background-color: #F8FAFC; color: #0F172A; padding: 40px;">
                <div style="max-width: 580px; margin: 0 auto; background: #FFFFFF; padding: 40px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h2 style="color: #2563EB;">Bienvenue sur Zemy !</h2>
                    <p>Bonjour {full_name},</p>
                    <p>Un compte administrateur a été créé pour vous sur le tableau de bord Zemy.</p>
                    <p>Voici vos identifiants de connexion :</p>
                    <p><strong>Email :</strong> {email}</p>
                    <p><strong>Mot de passe :</strong> {password}</p>
                    <p>Nous vous conseillons de vous connecter et de modifier ce mot de passe depuis votre profil dès que possible.</p>
                    <p>Cordialement,<br>L'équipe Zemy</p>
                </div>
            </body>
            </html>
            """
            
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Bonjour {full_name},\nVotre mot de passe est : {password}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email]
            )
            msg.attach_alternative(html_message, "text/html")
            msg.send(fail_silently=True)

        return Response({"status": "Administrateur créé avec succès.", "email": email})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def archive(self, request, pk=None):
        user = self.get_object()
        reason = request.data.get('reason', '')
        
        with transaction.atomic():
            user.is_archived = True
            user.is_active = False
            user.archived_at = timezone.now()
            user.archived_by = request.user
            user.archive_reason = reason
            user.save(update_fields=['is_archived', 'is_active', 'archived_at', 'archived_by', 'archive_reason'])
            
            from django.contrib.sessions.models import Session
            for s in Session.objects.filter(expire_date__gte=timezone.now()):
                data = s.get_decoded()
                if data.get('_auth_user_id') == str(user.id):
                    s.delete()
                    
            AuditLog.objects.create(
                admin_user=request.user,
                target_user=user,
                action="archive",
                reason=reason
            )
            
        return Response({"status": "Utilisateur archivé avec succès."})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def restore(self, request, pk=None):
        user = self.get_object()
        
        with transaction.atomic():
            user.is_archived = False
            user.is_active = True
            user.archived_at = None
            user.archived_by = None
            user.archive_reason = ''
            user.save(update_fields=['is_archived', 'is_active', 'archived_at', 'archived_by', 'archive_reason'])
            
            AuditLog.objects.create(
                admin_user=request.user,
                target_user=user,
                action="restore",
                reason="Restauration du compte utilisateur"
            )
            
        return Response({"status": "Utilisateur restauré avec succès."})

    @action(detail=True, methods=['delete'], url_path='permanent-delete', permission_classes=[permissions.IsAdminUser])
    def permanent_delete(self, request, pk=None):
        user = self.get_object()
        full_name = getattr(user, 'full_name', 'Anonyme') or 'Anonyme'
        phone = getattr(user, 'phone', 'N/A')
        email = getattr(user, 'email', 'N/A')
        user_details = f"{full_name} (Tél: {phone}, Email: {email})"
        
        with transaction.atomic():
            AuditLog.objects.create(
                admin_user=request.user,
                target_user=None,
                action="permanent_delete",
                reason=f"Suppression définitive de l'utilisateur : {user_details}"
            )
            user.delete()
            
        return Response({"status": "Utilisateur supprimé définitivement avec succès."})

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAdminUser])
    def archived(self, request):
        queryset = User.objects.filter(is_archived=True).order_by('-archived_at')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='rate')
    def rate_user(self, request, pk=None):
        user_to_rate = self.get_object()
        rating = request.data.get('rating')
        if rating is None:
            return Response({"error": "Note requise."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            rating = float(rating)
            if rating < 1 or rating > 5:
                raise ValueError()
        except ValueError:
            return Response({"error": "Note invalide (doit être entre 1 et 5)."}, status=status.HTTP_400_BAD_REQUEST)
            
        if user_to_rate.rating == 0.0:
            user_to_rate.rating = rating
        else:
            user_to_rate.rating = (user_to_rate.rating + rating) / 2.0
            
        user_to_rate.save(update_fields=['rating'])
        
        create_and_send_notification(
            user=user_to_rate,
            title="Avis reçu",
            message=f"Vous avez reçu une nouvelle note de {rating}/5 de la part d'un utilisateur.",
            data={'type': 'rating_received', 'screen': 'profile'}
        )
        
        return Response({"status": "Note enregistrée avec succès.", "new_rating": user_to_rate.rating})

class UserPreferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant les préférences de trajet (musique, discussion, etc.).
    """
    queryset = UserPreference.objects.all()
    serializer_class = UserPreferenceSerializer
    # BUG-011 FIX : permission_classes explicite pour éviter l'héritage des defaults DRF.
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserPreference.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        # BUG-008 FIX : IDOR — Ne jamais accepter le user_id du frontend.
        # On force l'utilisateur connecté comme propriétaire de la préférence.
        # Avant ce fix, n'importe qui pouvait envoyer user_id=<UUID_autre> et
        # modifier les préférences d'un autre utilisateur.
        pref, created = UserPreference.objects.update_or_create(
            user=request.user,  # ← Forcé depuis le token JWT, pas depuis le body
            defaults={
                'music': request.data.get('music', True),
                'smoking': request.data.get('smoking', False),
                'chatty': request.data.get('chatty', True),
                'air_conditioner': request.data.get('air_conditioner', True),
                'pets_allowed': request.data.get('pets_allowed', False),
                'luggage_allowed': request.data.get('luggage_allowed', True),
                'stops_allowed': request.data.get('stops_allowed', True),
            }
        )
        serializer = self.get_serializer(pref)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@extend_schema(request=dict, responses={200: dict}, tags=['Notifications'])
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def save_fcm_token(request):
    """
    Enregistre le token FCM de l'appareil de l'utilisateur connecté.
    """
    token = request.data.get('fcm_token', '').strip()
    if not token:
        return Response({'error': 'fcm_token requis.'}, status=status.HTTP_400_BAD_REQUEST)
    request.user.fcm_token = token
    request.user.save(update_fields=['fcm_token'])
    return Response({'status': 'FCM token enregistré avec succès.'})

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_profile(request):
    """
    Permet à l'utilisateur connecté de modifier ses informations.
    """
    user = request.user
    full_name = request.data.get('full_name')
    email = request.data.get('email')
    phone = request.data.get('phone')

    if email and email != user.email and User.objects.filter(email=email).exclude(id=user.id).exists():
        return Response({'error': 'Cet email est déjà utilisé.'}, status=status.HTTP_400_BAD_REQUEST)
    
    if phone and phone != user.phone and User.objects.filter(phone=phone).exclude(id=user.id).exists():
        return Response({'error': 'Ce numéro de téléphone est déjà utilisé.'}, status=status.HTTP_400_BAD_REQUEST)

    if full_name:
        user.full_name = full_name
    if email:
        user.email = email
    if phone:
        user.phone = phone
        
    user.save()
    
    if user.is_staff:
        data = AdminUserSerializer(user, context={'request': request}).data
    else:
        data = UserSerializer(user, context={'request': request}).data
        
    return Response({"status": "Profil mis à jour", "user": data})
