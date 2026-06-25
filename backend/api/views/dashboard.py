# pyrefly: ignore [missing-import]
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import models, transaction
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import timedelta
import random
import os
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
import email
import email.policy

logger = logging.getLogger(__name__)

from ..models import (
    Vehicle, UserPreference, Ride, Booking, Conversation, Message, Notification, 
    AppBranding, VerificationRequest, Promotion, MobileSettings,
    FinancialSettings, RefundRequest, Transaction, Parcel, Payment, PasswordResetOTP, PopularPlace
)
from ..serializers import (
    UserSerializer, AdminUserSerializer, VehicleSerializer, UserPreferenceSerializer, 
    RideSerializer, BookingSerializer, ConversationSerializer, MessageSerializer, NotificationSerializer, AppBrandingSerializer,
    VerificationRequestSerializer, PromotionSerializer, MobileSettingsSerializer,
    FinancialSettingsSerializer, RefundRequestSerializer, TransactionSerializer, ParcelSerializer, PopularPlaceSerializer
)
from ..fcm import send_fcm_to_user, send_fcm_to_all_users, create_and_send_notification

User = get_user_model()

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

try:
    if not firebase_admin._apps:
        cred_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
except Exception:
    pass

@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])

def dashboard_stats(request):
    """
    Renvoie les statistiques agrégées pour le tableau de bord Administrateur.
    
    Returns:
        Response: Dictionnaire contenant les KPI (chiffre d'affaires, utilisateurs, trajets actifs...).
    """
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Sum, Count

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Users
    total_users = User.objects.count()
    verified_users = User.objects.filter(is_verified=True).count()
    unverified_users = total_users - verified_users
    # Rough estimate of passengers vs drivers: drivers have vehicles
    drivers = Vehicle.objects.values('owner').distinct().count()
    passengers = total_users - drivers
    pending_verifications = VerificationRequest.objects.filter(status='pending').count()

    # Rides
    active_rides = Ride.objects.filter(status__in=['active', 'started']).count()
    today_rides = Ride.objects.filter(created_at__gte=today_start).count()
    completed_rides = Ride.objects.filter(status='completed').count()
    cancelled_rides = Ride.objects.filter(status='cancelled').count()

    # Bookings
    today_bookings = Booking.objects.filter(created_at__gte=today_start).count()
    monthly_bookings = Booking.objects.filter(created_at__gte=month_start).count()
    confirmed_bookings = Booking.objects.filter(status='confirmed').count()
    cancelled_bookings = Booking.objects.filter(status='cancelled').count()

    # Parcels
    sent_parcels = Parcel.objects.count()
    delivered_parcels = Parcel.objects.filter(status='delivered').count()

    # Financials
    transactions = Transaction.objects.filter(status='completed')
    total_revenue = transactions.aggregate(Sum('amount'))['amount__sum'] or 0
    monthly_revenue = transactions.filter(created_at__gte=month_start).aggregate(Sum('amount'))['amount__sum'] or 0
    total_commission = transactions.aggregate(Sum('zemy_commission'))['zemy_commission__sum'] or 0
    
    refunds = RefundRequest.objects.filter(status='approved')
    total_refunded = refunds.aggregate(Sum('amount'))['amount__sum'] or 0
    pending_refunds = RefundRequest.objects.filter(status='pending').count()

    # Time series (last 7 days revenue)
    revenue_chart = []
    rides_chart = []
    # French days
    days_fr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    for i in range(6, -1, -1):
        d_start = today_start - timedelta(days=i)
        d_end = d_start + timedelta(days=1)
        day_rev = transactions.filter(created_at__gte=d_start, created_at__lt=d_end).aggregate(Sum('amount'))['amount__sum'] or 0
        day_rides = Ride.objects.filter(created_at__gte=d_start, created_at__lt=d_end).count()
        label = days_fr[d_start.weekday()]
        revenue_chart.append({'x': label, 'y': float(day_rev)})
        rides_chart.append({'x': label, 'y': day_rides})

    # Recent activity
    recent_bookings = Booking.objects.select_related('passenger').order_by('-created_at')[:5]
    recent_rides = Ride.objects.select_related('driver').order_by('-created_at')[:5]
    
    activities = []
    for b in recent_bookings:
        activities.append({
            'id': f'b_{b.id}',
            'type': 'Nouvelle réservation',
            'user': b.passenger.full_name if b.passenger.full_name else b.passenger.phone,
            'time': b.created_at,
            'icon': 'ph:ticket-fill',
            'color': 'bg-primary/20 text-primary'
        })
    for r in recent_rides:
        activities.append({
            'id': f'r_{r.id}',
            'type': 'Nouveau trajet',
            'user': r.driver.full_name if r.driver.full_name else r.driver.phone,
            'time': r.created_at,
            'icon': 'ph:car-fill',
            'color': 'bg-secondary/20 text-secondary'
        })
    
    activities.sort(key=lambda x: x['time'], reverse=True)
    for a in activities:
        a['time'] = a['time'].isoformat()
    activities = activities[:6]

    # Map Data: active rides coordinates (mock fallback since some rides might lack lat/lng)
    active_rides_qs = Ride.objects.filter(status__in=['active', 'started'])[:20]
    map_data = []
    for r in active_rides_qs:
        lat = r.departure_lat
        lng = r.departure_lng
        # Si pas de coordonnées, on génère un point au pif proche du centre (Cotonou, Bénin)
        if not lat or not lng:
            import random
            lat = 6.36536 + random.uniform(-0.05, 0.05)
            lng = 2.41833 + random.uniform(-0.05, 0.05)
        map_data.append({
            'id': r.id,
            'lat': float(lat),
            'lng': float(lng),
            'driver': r.driver.full_name if r.driver.full_name else r.driver.phone,
            'status': r.status
        })

    return Response({
        'users': {
            'total': total_users,
            'verified': verified_users,
            'unverified': unverified_users,
            'drivers': drivers,
            'passengers': passengers,
            'pending_verifications': pending_verifications
        },
        'rides': {
            'active': active_rides,
            'today': today_rides,
            'completed': completed_rides,
            'cancelled': cancelled_rides
        },
        'bookings': {
            'today': today_bookings,
            'monthly': monthly_bookings,
            'confirmed': confirmed_bookings,
            'cancelled': cancelled_bookings
        },
        'parcels': {
            'sent': sent_parcels,
            'delivered': delivered_parcels
        },
        'financials': {
            'total_revenue': float(total_revenue),
            'monthly_revenue': float(monthly_revenue),
            'total_commission': float(total_commission),
            'total_refunded': float(total_refunded),
            'pending_refunds': pending_refunds
        },
        'charts': {
            'revenue_7d': revenue_chart,
            'rides_7d': rides_chart
        },
        'activities': activities,
        'map_data': map_data
    })


