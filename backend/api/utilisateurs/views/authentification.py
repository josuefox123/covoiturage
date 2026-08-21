from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
import random
import logging
from drf_spectacular.utils import extend_schema, OpenApiParameter
from ...throttles import LoginThrottle, OTPThrottle, ResetPasswordThrottle

logger = logging.getLogger(__name__)
User = get_user_model()

from ...models.utilisateur import User, PasswordResetOTP
from ...serializers import UserSerializer, RegisterSerializer
from .helpers import send_zemy_reset_email

import firebase_admin
from firebase_admin import auth as firebase_auth

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([OTPThrottle])
@csrf_exempt
def verify_code(request):
    """
    Vérifie le code OTP saisi par l'utilisateur.
    """
    firebase_token = request.data.get('firebase_token')
    full_name = request.data.get('full_name', '') # For registration
    phone = request.data.get('phone', '') # Sent by frontend in dev mode
    
    if not firebase_token:
        return Response({'error': 'Jeton Firebase requis.'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # SEV-014: Le bypass de jeton de développement '123456' est réservé STRICTEMENT au mode DEBUG.
        if firebase_token == '123456' and settings.DEBUG:
            if not phone:
                return Response({'error': 'Numéro de téléphone requis pour le mode dev.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if firebase_token == '123456':
                # Bypass refusé silencieusement ou explicitement en production
                return Response({'error': 'Vérification de sécurité requise.'}, status=status.HTTP_400_BAD_REQUEST)
                
            if not firebase_admin._apps:
                return Response({'error': 'Firebase Admin non configuré sur le serveur.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            decoded_token = firebase_auth.verify_id_token(firebase_token)
            phone = decoded_token.get('phone_number')
            
            if not phone:
                return Response({'error': 'Le jeton ne contient pas de numéro de téléphone vérifié.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user, created = User.objects.get_or_create(phone=phone)
        if getattr(user, 'is_archived', False):
            return Response({
                "detail": "Votre compte a été archivé. Veuillez contacter le support Zemy."
            }, status=status.HTTP_403_FORBIDDEN)
            
        if created and full_name:
            user.full_name = full_name
            user.save()
            
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
            'is_new_user': created
        })
    except Exception as e:
        return Response({'error': 'Code invalide ou expiré.'}, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    parameters=[
        OpenApiParameter('email', str, description='Email à vérifier', required=False),
        OpenApiParameter('phone', str, description='Numéro de téléphone à vérifier', required=False),
    ],
    responses={200: dict},
    tags=['Authentification']
)
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def register_user(request):
    """
    Enregistre un nouvel utilisateur.
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginThrottle])
@csrf_exempt
def login_user(request):
    """
    Connecte un utilisateur existant.
    """
    identifier = request.data.get('identifier')
    password = request.data.get('password')

    if not identifier or not password:
        return Response({'error': 'Veuillez fournir un identifiant et un mot de passe.'}, status=status.HTTP_400_BAD_REQUEST)

    ident = identifier.strip()
    user = User.objects.filter(phone__iexact=ident).first()
    if not user and ident.isdigit():
        user = User.objects.filter(phone__iexact=f'+229{ident}').first()
    if not user:
        user = User.objects.filter(email__iexact=ident).first()

    if user and getattr(user, 'is_archived', False):
        return Response({
            "detail": "Votre compte a été archivé. Veuillez contacter le support Zemy."
        }, status=status.HTTP_403_FORBIDDEN)

    if user and user.check_password(password):
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        user_data['is_staff'] = getattr(user, 'is_staff', False)
        user_data['is_superuser'] = getattr(user, 'is_superuser', False)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': user_data
        })
    return Response({'error': 'Identifiants invalides.'}, status=status.HTTP_401_UNAUTHORIZED)

@extend_schema(request=dict, responses={200: dict, 400: dict, 500: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([ResetPasswordThrottle])
@csrf_exempt
def send_reset_code(request):
    """
    Génère et envoie un code OTP à l'adresse e-mail spécifiée pour réinitialiser le mot de passe.
    """
    email = request.data.get('email') or request.data.get('email_or_phone')
    if not email:
        return Response({'error': "L'adresse email est requise."}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip()
    user = User.objects.filter(email__iexact=email).first()
    
    # SEV-015: Obfuscation pour masquer l'existence du compte (protection contre l'énumération)
    if not user:
        # On retourne un message de succès factice sans envoyer de mail pour ne pas donner d'indice à un attaquant
        return Response({'message': "Code de réinitialisation envoyé avec succès par email si le compte existe."}, status=status.HTTP_200_OK)
    
    PasswordResetOTP.objects.filter(email__iexact=email).delete()
    
    code = str(random.randint(100000, 999999))
    PasswordResetOTP.objects.create(email=email.lower(), code=code)
    
    try:
        send_zemy_reset_email(user.full_name or "Utilisateur Zemy", email, code)
        return Response({'message': "Code de réinitialisation envoyé avec succès par email si le compte existe."}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': "Une erreur est survenue lors de l'envoi de l'e-mail. Veuillez vérifier votre configuration."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def verify_reset_code(request):
    """
    Vérifie si le code OTP fourni pour un e-mail est correct, non expiré et n'a pas dépassé les tentatives.
    """
    email = request.data.get('email') or request.data.get('email_or_phone')
    code = request.data.get('code')
    
    if not email or not code:
        return Response({'error': "L'adresse email et le code OTP sont requis."}, status=status.HTTP_400_BAD_REQUEST)
    
    email = email.strip()
    otp = PasswordResetOTP.objects.filter(email__iexact=email).first()
    if not otp:
        return Response({'error': "Aucun code n'a été demandé pour cette adresse email."}, status=status.HTTP_400_BAD_REQUEST)
    
    if otp.is_verified:
        return Response({'message': "Code déjà vérifié avec succès."}, status=status.HTTP_200_OK)
        
    if otp.attempts >= 5:
        return Response({'error': "Nombre maximum de tentatives de validation dépassé. Veuillez demander un nouveau code."}, status=status.HTTP_400_BAD_REQUEST)
        
    if timezone.now() - otp.created_at > timedelta(minutes=10):
        return Response({'error': "Le code de validation a expiré. Veuillez en demander un nouveau."}, status=status.HTTP_400_BAD_REQUEST)
        
    if otp.code != code:
        otp.attempts += 1
        otp.save()
        remaining = 5 - otp.attempts
        if remaining <= 0:
            return Response({'error': "Nombre maximum de tentatives dépassé. Veuillez demander un nouveau code."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': f"Code de validation incorrect. Il vous reste {remaining} tentatives."}, status=status.HTTP_400_BAD_REQUEST)
        
    otp.is_verified = True
    otp.save()
    return Response({'message': "Code vérifié avec succès."}, status=status.HTTP_200_OK)

@extend_schema(request=dict, responses={200: dict, 400: dict, 404: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def reset_password(request):
    """
    Modifie le mot de passe après vérification réussie du code OTP.
    """
    email = request.data.get('email') or request.data.get('email_or_phone')
    code = request.data.get('code')
    password = request.data.get('password')
    
    if not email or not code or not password:
        return Response({'error': "Tous les champs sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        
    email = email.strip()
    otp = PasswordResetOTP.objects.filter(email__iexact=email).first()
    if not otp or not otp.is_verified:
        return Response({'error': "Veuillez d'abord vérifier le code de validation OTP."}, status=status.HTTP_400_BAD_REQUEST)
        
    if timezone.now() - otp.created_at > timedelta(minutes=10):
        return Response({'error': "Le code de validation a expiré. Veuillez recommencer la procédure."}, status=status.HTTP_400_BAD_REQUEST)
        
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({'error': "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        
    user.set_password(password)
    user.save()
    otp.delete()
    
    return Response({'message': "Votre mot de passe a été modifié avec succès."}, status=status.HTTP_200_OK)

@extend_schema(request=dict, responses={200: dict, 400: dict}, tags=['Authentification'])
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """
    Permet à l'administrateur de modifier son mot de passe depuis le profil.
    """
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not old_password or not new_password:
        return Response({"error": "Veuillez fournir l'ancien et le nouveau mot de passe."}, status=status.HTTP_400_BAD_REQUEST)
        
    if not user.check_password(old_password):
        return Response({"error": "L'ancien mot de passe est incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        
    user.set_password(new_password)
    user.save()
    
    return Response({"status": "Mot de passe modifié avec succès."})
