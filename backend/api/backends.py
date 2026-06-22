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

User = get_user_model()

class EmailOrPhoneModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        # 'username' will be whatever the user typed in the login field
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        try:
            # Check if it matches phone OR email OR full_name
            user = User.objects.get(Q(phone=username) | Q(email=username) | Q(full_name=username))
        except User.DoesNotExist:
            return None
        except User.MultipleObjectsReturned:
            user = User.objects.filter(Q(phone=username) | Q(email=username) | Q(full_name=username)).order_by('id').first()
            
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
