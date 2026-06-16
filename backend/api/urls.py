from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    verify_code, register_user, login_user, request_verification, verification_status,
    dashboard_stats,
    UserViewSet, VehicleViewSet, UserPreferenceViewSet,
    RideViewSet, BookingViewSet, ConversationViewSet, MessageViewSet, NotificationViewSet,
    AppBrandingView, VerificationRequestViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'vehicles', VehicleViewSet)
router.register(r'preferences', UserPreferenceViewSet)
router.register(r'rides', RideViewSet)
router.register(r'bookings', BookingViewSet)
router.register(r'conversations', ConversationViewSet)
router.register(r'messages', MessageViewSet)
router.register(r'notifications', NotificationViewSet)
router.register(r'verifications', VerificationRequestViewSet, basename='verification')

urlpatterns = [
    path('auth/verify-code/', verify_code, name='verify_code'),
    path('auth/register/', register_user, name='register_user'),
    path('auth/login/', login_user, name='login_user'),
    path('auth/request-verification/', request_verification, name='request_verification'),
    path('auth/verification-status/', verification_status, name='verification_status'),
    path('dashboard/stats/', dashboard_stats, name='dashboard_stats'),
    path('branding/', AppBrandingView.as_view(), name='app_branding'),
    path('', include(router.urls)),
]