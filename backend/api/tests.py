"""
========================================================

Fichier :
tests.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import AuditLog

User = get_user_model()

class UserArchiveTestCase(APITestCase):
    def setUp(self):
        # Create an admin user
        self.admin = User.objects.create_superuser(
            phone="+22997000000",
            password="adminpassword"
        )
        self.admin.full_name = "Admin Philotéos"
        self.admin.save()

        # Create a regular user
        self.user = User.objects.create_user(
            phone="+22997111111",
            password="userpassword"
        )
        self.user.full_name = "Jean Dupont"
        self.user.email = "jean.dupont@example.com"
        self.user.save()

    def test_archive_user(self):
        # Login admin
        self.client.force_authenticate(user=self.admin)
        
        # Archive user
        url = reverse('user-archive', args=[self.user.id])
        response = self.client.post(url, {'reason': 'Non respect des conditions'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify user state
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_archived)
        self.assertFalse(self.user.is_active)
        self.assertEqual(self.user.archive_reason, 'Non respect des conditions')
        self.assertEqual(self.user.archived_by, self.admin)
        
        # Verify AuditLog created
        self.assertTrue(AuditLog.objects.filter(target_user=self.user, action='archive').exists())

    def test_login_archived_user(self):
        # Archive user
        self.user.is_archived = True
        self.user.is_active = False
        self.user.save()

        # Try password login
        url = reverse('login_user')
        response = self.client.post(url, {
            'identifier': self.user.phone,
            'password': 'userpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['detail'], "Votre compte a été archivé. Veuillez contacter le support Zemy.")

    def test_jwt_archived_user(self):
        # Generate token while active
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)

        # Archive user
        self.user.is_archived = True
        self.user.is_active = False
        self.user.save()

        # Try authenticated request using the access token
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + access_token)
        url = reverse('user-list') # list active users
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.json()['detail'], "Votre compte a été archivé. Veuillez contacter le support Zemy.")

    def test_restore_user(self):
        # Archive user first
        self.user.is_archived = True
        self.user.is_active = False
        self.user.save()

        # Login admin
        self.client.force_authenticate(user=self.admin)

        # Restore user
        url = reverse('user-restore', args=[self.user.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify user state
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_archived)
        self.assertTrue(self.user.is_active)
        self.assertIsNone(self.user.archived_by)

        # Verify AuditLog created
        self.assertTrue(AuditLog.objects.filter(target_user=self.user, action='restore').exists())

    def test_permanent_delete_user(self):
        # Login admin
        self.client.force_authenticate(user=self.admin)

        # Permanent delete user
        url = reverse('user-permanent-delete', args=[self.user.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify user deleted
        self.assertFalse(User.objects.filter(id=self.user.id).exists())

        # Verify AuditLog exists and target_user is NULL
        self.assertTrue(AuditLog.objects.filter(action='permanent_delete', target_user__isnull=True).exists())


# Create your tests here.
