"""
========================================================

Fichier :
backends.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.utils.translation import gettext_lazy as _

User = get_user_model()

class EmailOrPhoneModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        # 'username' will be whatever the user typed in the login field
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        user = None
        try:
            from .utilisateurs.views.helpers import get_phone_candidates
            candidates = get_phone_candidates(username)
            if candidates:
                user = User.objects.filter(Q(phone__in=candidates) | Q(email__iexact=username)).order_by('id').first()
            else:
                user = User.objects.filter(email__iexact=username).order_by('id').first()
            if not user:
                dummy = User()
                dummy.set_password(password or "dummy")
        except Exception:
            dummy = User()
            dummy.set_password(password or "dummy")
            
        if user:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        else:
            # Vérification factice supplémentaire pour harmoniser le timing
            User().check_password(password or "dummy")
        return None

class SafeJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            raise InvalidToken(_("Token contained no recognizable user identification"))

        try:
            user = self.user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
        except self.user_model.DoesNotExist:
            raise AuthenticationFailed(_("User not found"), code="user_not_found")

        if getattr(user, 'is_archived', False):
            raise AuthenticationFailed(
                "Votre compte a été archivé. Veuillez contacter le support Zemy.",
                code="user_archived"
            )

        if not user.is_active:
            raise AuthenticationFailed(_("User is inactive"), code="user_inactive")

        return user

