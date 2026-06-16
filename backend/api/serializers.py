from rest_framework import serializers
from .models import User, Vehicle, UserPreference, Ride, Booking, Conversation, Message, Notification

class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    preference = UserPreferenceSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone', 'avatar', 'rating', 'is_verified', 'is_active', 'created_at', 'preference']

class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone', 'avatar', 'rating', 'is_verified', 'is_active', 'created_at', 'password']
        read_only_fields = ['id', 'created_at', 'rating']

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
    class Meta:
        model = Vehicle
        fields = '__all__'



class RideSerializer(serializers.ModelSerializer):
    driver_details = UserSerializer(source='driver', read_only=True)
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)

    class Meta:
        model = Ride
        fields = '__all__'
        read_only_fields = ['driver']

class BookingSerializer(serializers.ModelSerializer):
    passenger_details = UserSerializer(source='passenger', read_only=True)
    ride_details = RideSerializer(source='ride', read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ['passenger']

class MessageSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'sender_details', 'content',
                  'message_type', 'attachment', 'attachment_url',
                  'location_lat', 'location_lng', 'is_read', 'is_urgent', 'created_at']
        read_only_fields = ['sender', 'is_read']

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if obj.attachment and hasattr(obj.attachment, 'url'):
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None

class ConversationSerializer(serializers.ModelSerializer):
    participant_1_details = UserSerializer(source='participant_1', read_only=True)
    participant_2_details = UserSerializer(source='participant_2', read_only=True)
    ride_details = RideSerializer(source='ride', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    has_urgent_unread = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = '__all__'

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return MessageSerializer(last_msg, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

    def get_has_urgent_unread(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.messages.filter(is_read=False, is_urgent=True).exclude(sender=request.user).exists()
        return False

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['full_name', 'email', 'phone', 'password']
        
    def create(self, validated_data):
        user = User.objects.create_user(
            phone=validated_data['phone'],
            email=validated_data.get('email', ''),
            full_name=validated_data.get('full_name', ''),
            password=validated_data['password']
        )
        return user

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

class AppBrandingSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import AppBranding
        model = AppBranding
        fields = '__all__'

class VerificationRequestSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        from .models import VerificationRequest
        model = VerificationRequest
        fields = '__all__'
