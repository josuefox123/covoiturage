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
    verify_code, register_user, login_user, check_availability,
    request_verification, verification_status,
    dashboard_stats, save_fcm_token, payment_checkout, confirm_payment, sync_payments,
    PaymentViewSet,
    UserViewSet, VehicleViewSet, UserPreferenceViewSet,
    RideViewSet, BookingViewSet, ConversationViewSet, MessageViewSet, NotificationViewSet,
    AppBrandingView, VerificationRequestViewSet, PromotionViewSet, MobileSettingsView,
    FinancialSettingsViewSet, RefundRequestViewSet, TransactionViewSet, ParcelViewSet,
    PopularPlaceViewSet, send_reset_code, verify_reset_code, reset_password,
    update_profile, change_password,
    contact_view, SupportTicketViewSet,
    DriverEarningsView, DriverClaimPayoutView,
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
router.register(r'popular-places', PopularPlaceViewSet, basename='popular_place')
router.register(r'support-tickets', SupportTicketViewSet, basename='support_ticket')
router.register(r'payments', PaymentViewSet, basename='payments')

urlpatterns = [
    path('auth/verify-code/', verify_code, name='verify_code'),
    path('auth/register/', register_user, name='register_user'),
    path('auth/login/', login_user, name='login_user'),
    path('auth/check-availability/', check_availability, name='check_availability'),
    path('auth/request-verification/', request_verification, name='request_verification'),
    path('auth/verification-status/', verification_status, name='verification_status'),
    path('auth/fcm-token/', save_fcm_token, name='save_fcm_token'),
    path('auth/send-reset-code/', send_reset_code, name='send_reset_code'),
    path('auth/verify-reset-code/', verify_reset_code, name='verify_reset_code'),
    path('auth/reset-password/', reset_password, name='reset_password'),
    path('auth/update-profile/', update_profile, name='update_profile'),
    path('auth/change-password/', change_password, name='change_password'),
    path('dashboard/stats/', dashboard_stats, name='dashboard_stats'),
    path('branding/', AppBrandingView.as_view(), name='app_branding'),
    path('mobile-settings/', MobileSettingsView.as_view(), name='mobile_settings'),
    path('payments/', include('api.payments.urls')),
    path('contact/', contact_view, name='contact'),
    path('driver/earnings/', DriverEarningsView.as_view(), name='driver_earnings'),
    path('driver/claim/', DriverClaimPayoutView.as_view(), name='driver_claim_payout'),
    path('', include(router.urls)),
]