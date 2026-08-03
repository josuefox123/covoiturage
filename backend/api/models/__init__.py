"""
Zemy ? models/__init__.py
Re-exporte tous les modeles pour compatibilite backward avec les imports existants.
"""
from .utilisateur import UserManager, User, Vehicle, UserPreference, VerificationRequest, PasswordResetOTP
from .trajet import RideSeries, Ride, RideLeg, RideWaypoint, DirectionsCache, SearchAlert
from .reservation import Booking
from .messagerie import Conversation, Message, ModerationLog
from .notification import Notification
from .paiement import FinancialSettings, RefundRequest, Transaction, Payment, DriverPayout
from .colis import Parcel
from .support import SupportTicket
from .parametres import AppBranding, MobileSettings, Promotion, PopularPlace, AuditLog

__all__ = [
    'UserManager', 'User', 'Vehicle', 'UserPreference', 'VerificationRequest', 'PasswordResetOTP',
    'RideSeries', 'Ride', 'RideLeg', 'RideWaypoint', 'DirectionsCache', 'SearchAlert',
    'Booking',
    'Conversation', 'Message', 'ModerationLog',
    'Notification',
    'FinancialSettings', 'RefundRequest', 'Transaction', 'Payment', 'DriverPayout',
    'Parcel',
    'SupportTicket',
    'AppBranding', 'MobileSettings', 'Promotion', 'PopularPlace', 'AuditLog',
]