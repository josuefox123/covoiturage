"""
========================================================

Fichier :
serializers.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from api.models import Payment
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from .models import User, Vehicle, UserPreference, Ride, Booking, Conversation, Message, Notification, FinancialSettings, RefundRequest, Transaction, Parcel, SupportTicket

class UserPreferenceSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les préférences utilisateur (musique, bagages, animaux).
    """
    class Meta:
        model = UserPreference
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour le modèle User.
    Gère l'affichage des informations utilisateur et inclut des champs calculés
    tels que le nombre de trajets et les véhicules possédés.
    """
    preference = UserPreferenceSerializer(read_only=True)
    vehicles = serializers.SerializerMethodField()
    rides_count = serializers.SerializerMethodField()
    verification_status = serializers.SerializerMethodField()
    # Nombre de trajets effectués en tant que passager (proxy pour les avis)
    reviews_count = serializers.SerializerMethodField()
    # Total FCFA dépensé en covoiturage (trajets completés en tant que passager)
    total_spent = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'email', 'phone', 'country', 'avatar',
            'rating', 'parcels_completed', 'parcel_rating',
            'is_verified', 'is_active', 'created_at',
            'preference', 'vehicles',
            'rides_count', 'reviews_count', 'total_spent',
            'verification_status',
        ]

    @extend_schema_field(dict)
    def get_vehicles(self, obj):
        return VehicleSerializer(obj.vehicles.all(), many=True).data

    @extend_schema_field(int)
    def get_rides_count(self, obj):
        """Nombre de trajets complétés en tant que conducteur."""
        return obj.rides_driven.filter(status='completed').count()

    @extend_schema_field(int)
    def get_reviews_count(self, obj):
        """
        Nombre de réservations complétées en tant que passager.
        Utilisé comme proxy pour le nombre d'avis.
        """
        return obj.bookings.filter(status='completed').count()

    @extend_schema_field(int)
    def get_total_spent(self, obj):
        """
        Total FCFA dépensé par l'utilisateur en covoiturage
        (somme des prix des réservations complétées).
        """
        from django.db.models import Sum, F, ExpressionWrapper, IntegerField
        result = obj.bookings.filter(status='completed').aggregate(
            total=Sum(
                ExpressionWrapper(
                    F('seats_booked') * F('ride__price_per_seat'),
                    output_field=IntegerField()
                )
            )
        )
        return result['total'] or 0


    @extend_schema_field(str)
    def get_verification_status(self, obj):
        if obj.is_verified:
            return 'verified'
        from .models import VerificationRequest
        existing = VerificationRequest.objects.filter(user=obj).first()
        if existing:
            if existing.status == 'approved':
                return 'verified'
            elif existing.status == 'rejected':
                return 'rejected'
            else:
                return 'pending'
        return 'not_verified'

class AdminUserSerializer(serializers.ModelSerializer):
    """
    Sérialiseur complet du modèle User pour le tableau de bord administrateur.
    Inclut des champs sensibles et toutes les informations.
    """
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    archived_by_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'email', 'phone', 'avatar', 'rating', 
            'is_verified', 'is_active', 'is_staff', 'created_at', 'password',
            'is_archived', 'archived_at', 'archive_reason', 'archived_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'rating', 'archived_at', 'archived_by_name']

    def get_archived_by_name(self, obj):
        if obj.archived_by:
            return obj.archived_by.full_name or obj.archived_by.phone
        return None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class VehicleSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour le modèle Vehicle.
    Gère la création et mise à jour des véhicules d'un conducteur.
    """
    class Meta:
        model = Vehicle
        fields = '__all__'



class RideSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour le modèle Ride (Trajet).
    Valide les lieux de départ/arrivée, les prix et les options de colis.
    Inclus les relations imbriquées (conducteur, véhicule) en lecture.
    """
    driver_details = UserSerializer(source='driver', read_only=True)
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)

    class Meta:
        model = Ride
        fields = '__all__'
        read_only_fields = ['driver', 'price_per_seat', 'zemy_commission']

class BookingSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour le modèle Booking (Réservation).
    Valide le nombre de places et expose les informations du passager.
    """
    passenger_details = UserSerializer(source='passenger', read_only=True)
    ride_details = RideSerializer(source='ride', read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['passenger']

class ParcelSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour la gestion de l'envoi de colis.
    """
    sender_user_details = UserSerializer(source='sender_user', read_only=True)
    ride_details = RideSerializer(source='ride', read_only=True)

    class Meta:
        model = Parcel
        fields = '__all__'
        read_only_fields = ['qr_code_data', 'zemy_commission', 'driver_payout']


class MessageSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les messages (Textes, Images, Audio).
    """
    sender_details = UserSerializer(source='sender', read_only=True)
    attachment_url = serializers.SerializerMethodField()
    moderation_status = serializers.CharField(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'sender_details', 'content',
                  'message_type', 'attachment', 'attachment_url',
                  'location_lat', 'location_lng', 'is_read', 'is_urgent', 'created_at', 'moderation_status']
        read_only_fields = ['sender', 'is_read', 'moderation_status']

    def create(self, validated_data):
        from .services.moderation_service import MessageModerator
        from .models import ModerationLog

        content = validated_data.get('content', '')
        moderation_status = 'accepted'
        moderation_result: dict = {}

        if content and validated_data.get('message_type', 'text') == 'text':
            moderation_result = MessageModerator.analyze_and_filter(content)
            moderation_status = moderation_result['status']

            if moderation_status in ['modified', 'blocked']:
                validated_data['content'] = moderation_result['filtered_content']

        # Save the message
        message = super().create(validated_data)

        # We temporarily store moderation_status on the instance to be used by the serializer representation
        message.moderation_status = moderation_status

        # Log if modified or blocked
        if moderation_status in ['modified', 'blocked'] and moderation_result:
            ModerationLog.objects.create(
                message=message,
                sender=message.sender,
                original_content=content,
                modified_content=moderation_result['filtered_content'],
                action_taken=moderation_status,
                detected_types=moderation_result['detected']
            )

        return message

    @extend_schema_field(str)
    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if obj.attachment and hasattr(obj.attachment, 'url'):
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None

class ConversationSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les conversations (Messagerie et Support).
    Expose le dernier message, le nombre de non-lus et l'urgence.
    """
    participant_1_details = UserSerializer(source='participant_1', read_only=True)
    participant_2_details = UserSerializer(source='participant_2', read_only=True)
    ride_details = RideSerializer(source='ride', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    has_urgent_unread = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = '__all__'

    @extend_schema_field(dict)
    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return MessageSerializer(last_msg, context=self.context).data
        return None

    @extend_schema_field(int)
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

    @extend_schema_field(bool)
    def get_has_urgent_unread(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.messages.filter(is_read=False, is_urgent=True).exclude(sender=request.user).exists()
        return False

class RegisterSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour l'inscription d'un nouvel utilisateur.
    Accepte le pays de l'utilisateur (code ISO 2 lettres) pour les marchés africains multi-pays.
    """
    password = serializers.CharField(write_only=True)
    # Code pays optionnel – défaut Bénin si non fourni
    country = serializers.CharField(max_length=5, required=False, default='BJ')
    
    class Meta:
        model = User
        fields = ['full_name', 'email', 'phone', 'password', 'country']
        
    def create(self, validated_data):
        user = User.objects.create_user(
            phone=validated_data['phone'],
            email=validated_data.get('email', ''),
            full_name=validated_data.get('full_name', ''),
            country=validated_data.get('country', 'BJ'),
            password=validated_data['password']
        )
        return user

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

class NotificationSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les notifications (Alertes push FCM ou in-app).
    """
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = Notification
        fields = '__all__'

class AppBrandingSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import AppBranding
        model = AppBranding
        fields = '__all__'

class VerificationRequestSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les demandes de vérification d'identité.
    Gère l'upload de photos (Selfie, CNI).
    """
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        from .models import VerificationRequest
        model = VerificationRequest
        fields = '__all__'

class PromotionSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les bannières promotionnelles (Dashboard Admin).
    """
    class Meta:
        from .models import Promotion
        model = Promotion
        fields = '__all__'

class MobileSettingsSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les paramètres mobiles globaux.
    """
    class Meta:
        from .models import MobileSettings
        model = MobileSettings
        fields = '__all__'

class FinancialSettingsSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les paramètres financiers (Commissions).
    """
    class Meta:
        model = FinancialSettings
        fields = '__all__'

class RefundRequestSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les demandes de remboursement.
    """
    passenger_details = UserSerializer(source='passenger', read_only=True)
    driver_details = UserSerializer(source='driver', read_only=True)
    booking_details = BookingSerializer(source='booking', read_only=True)

    class Meta:
        model = RefundRequest
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les transactions financières.
    """
    ride_details = RideSerializer(source='ride', read_only=True)

    class Meta:
        model = Transaction
        fields = '__all__'

class PopularPlaceSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import PopularPlace
        model = PopularPlace
        fields = '__all__'


class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = '__all__'
        read_only_fields = ('id', 'ticket_number', 'status', 'created_at', 'updated_at', 'ip_address')

    def validate_message(self, value):
        from django.utils.html import strip_tags
        cleaned_value = strip_tags(value).strip()
        if len(cleaned_value) < 10:
            raise serializers.ValidationError("Le message doit contenir au moins 10 caractères.")
        return cleaned_value

    def validate(self, attrs):
        from django.utils.html import strip_tags
        if 'name' in attrs:
            attrs['name'] = strip_tags(attrs['name']).strip()
        if 'email' in attrs:
            attrs['email'] = strip_tags(attrs['email']).strip()
        if 'subject' in attrs:
            attrs['subject'] = strip_tags(attrs['subject']).strip()
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    booking_details = BookingSerializer(source='booking', read_only=True)
    parcel_details = ParcelSerializer(source='parcel', read_only=True)

    class Meta:
        model = Transaction
        fields = '__all__'


