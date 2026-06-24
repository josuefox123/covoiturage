"""
========================================================

Fichier :
admin.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
from django.contrib import admin
from .models import User, Vehicle, UserPreference, Ride, Booking, Conversation, Message, Promotion, MobileSettings, Payment

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('phone', 'full_name', 'email', 'rating', 'is_verified', 'is_active', 'created_at')
    search_fields = ('phone', 'full_name', 'email')
    list_filter = ('is_verified', 'is_active', 'is_staff')
    list_per_page = 20
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at')
    fieldsets = (
        ("Informations de connexion", {
            'fields': ('phone', 'email', 'password')
        }),
        ("Informations personnelles", {
            'fields': ('full_name', 'avatar', 'rating')
        }),
        ("Statut", {
            'fields': ('is_verified', 'is_active', 'is_staff', 'is_superuser')
        }),
        ("Métadonnées", {
            'fields': ('id', 'created_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('brand_model', 'license_plate', 'color', 'owner')
    search_fields = ('brand_model', 'license_plate', 'owner__phone', 'owner__full_name')
    list_filter = ('color',)
    list_per_page = 20
    autocomplete_fields = ['owner']

@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'music', 'smoking', 'chatty', 'air_conditioner')
    search_fields = ('user__phone', 'user__full_name')
    list_filter = ('music', 'smoking', 'chatty', 'air_conditioner')
    list_per_page = 20

@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = ('departure_location', 'arrival_location', 'departure_date', 'departure_time', 'driver', 'price_per_seat', 'seats_available', 'status')
    search_fields = ('departure_location', 'arrival_location', 'driver__phone', 'driver__full_name')
    list_filter = ('status', 'departure_date')
    ordering = ('-created_at',)
    list_per_page = 20
    date_hierarchy = 'departure_date'
    readonly_fields = ('id', 'created_at')

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'ride', 'passenger', 'seats_booked', 'status', 'created_at')
    search_fields = ('passenger__phone', 'passenger__full_name', 'ride__departure_location', 'ride__arrival_location')
    list_filter = ('status',)
    ordering = ('-created_at',)
    list_per_page = 20
    readonly_fields = ('id', 'created_at')

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'ride', 'participant_1', 'participant_2', 'created_at', 'updated_at')
    search_fields = ('participant_1__phone', 'participant_2__phone')
    ordering = ('-updated_at',)
    list_per_page = 20
    readonly_fields = ('id', 'created_at', 'updated_at')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'sender', 'is_read', 'created_at')
    search_fields = ('sender__phone', 'content')
    list_filter = ('is_read',)
    ordering = ('-created_at',)
    list_per_page = 25
    readonly_fields = ('id', 'created_at')

@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ('title', 'position', 'is_active', 'color', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('title', 'subtitle')
    ordering = ('position',)
    list_editable = ('position', 'is_active')

@admin.register(MobileSettings)
class MobileSettingsAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'show_promotions', 'updated_at')
    list_editable = ('show_promotions',)

    def has_add_permission(self, request):
        if self.model.objects.count() >= 1:
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction_id', 'amount', 'user', 'booking', 'parcel', 'status', 'provider', 'created_at')
    search_fields = ('transaction_id', 'user__phone', 'user__full_name')
    list_filter = ('status', 'provider')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
