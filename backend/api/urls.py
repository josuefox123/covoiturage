"""
========================================================

Fichier :
urls.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    verify_code, register_user, login_user, request_verification, verification_status,
    dashboard_stats, save_fcm_token,
    UserViewSet, VehicleViewSet, UserPreferenceViewSet,
    RideViewSet, BookingViewSet, ConversationViewSet, MessageViewSet, NotificationViewSet,
    AppBrandingView, VerificationRequestViewSet, PromotionViewSet, MobileSettingsView,
    FinancialSettingsViewSet, RefundRequestViewSet, TransactionViewSet, ParcelViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'preferences', UserPreferenceViewSet, basename='preference')
router.register(r'rides', RideViewSet, basename='ride')
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'verifications', VerificationRequestViewSet, basename='verification')
router.register(r'promotions', PromotionViewSet, basename='promotion')
router.register(r'financial-settings', FinancialSettingsViewSet, basename='financial_settings')
router.register(r'refund-requests', RefundRequestViewSet, basename='refund_requests')
router.register(r'transactions', TransactionViewSet, basename='transactions')
router.register(r'parcels', ParcelViewSet, basename='parcel')

urlpatterns = [
    path('auth/verify-code/', verify_code, name='verify_code'),
    path('auth/register/', register_user, name='register_user'),
    path('auth/login/', login_user, name='login_user'),
    path('auth/request-verification/', request_verification, name='request_verification'),
    path('auth/verification-status/', verification_status, name='verification_status'),
    path('auth/fcm-token/', save_fcm_token, name='save_fcm_token'),
    path('dashboard/stats/', dashboard_stats, name='dashboard_stats'),
    path('branding/', AppBrandingView.as_view(), name='app_branding'),
    path('mobile-settings/', MobileSettingsView.as_view(), name='mobile_settings'),
    path('', include(router.urls)),
]