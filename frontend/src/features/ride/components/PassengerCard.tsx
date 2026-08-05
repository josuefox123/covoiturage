import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking } from '../../../../src/types';
import { getMediaUrl } from '../../../../src/utils/media';

interface PassengerCardProps {
  booking: Booking;
  onMessage: (passengerId: string) => void;
  onCall: (phone?: string) => void;
}

const getBookingStatusDisplay = (status: string) => {
  switch (status) {
    case 'confirmed':
    case 'active':
      return { text: 'Confirmée', color: '#16A34A', bg: '#F0FDF4' };
    case 'pending':
    case 'pending_driver':
      return { text: 'En attente de validation', color: '#F59E0B', bg: '#FFFBEB' };
    case 'pending_passenger':
      return { text: 'Offre reçue', color: '#F59E0B', bg: '#FFFBEB' };
    case 'pending_payment':
      return { text: 'En attente de paiement', color: '#F59E0B', bg: '#FFFBEB' };
    case 'payment_processing':
      return { text: 'Paiement en cours', color: '#F59E0B', bg: '#FFFBEB' };
    case 'payment_failed':
      return { text: 'Paiement échoué', color: '#DC2626', bg: '#FEF2F2' };
    case 'payment_refunded':
      return { text: 'Remboursée', color: '#6B7280', bg: '#F3F4F6' };
    case 'started':
      return { text: 'Trajet démarré', color: '#16A34A', bg: '#F0FDF4' };
    case 'completed':
      return { text: 'Arrivé(e)', color: '#2F80ED', bg: '#EFF6FF' };
    case 'cancelled':
      return { text: 'Annulée', color: '#DC2626', bg: '#FEF2F2' };
    case 'rejected':
      return { text: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' };
    default:
      return { text: status.toUpperCase(), color: '#6B7280', bg: '#F3F4F6' };
  }
};

export function PassengerCard({ booking, onMessage, onCall }: PassengerCardProps) {
  const badge = getBookingStatusDisplay(booking.status);

  return (
    <View style={styles.passengerCard}>
      <View style={styles.passengerHeader}>
        {booking.passenger_details?.avatar ? (
          <Image source={{ uri: getMediaUrl(booking.passenger_details.avatar) }} style={styles.passengerAvatarImage} />
        ) : (
          <View style={styles.passengerAvatar}>
            <Text style={styles.passengerAvatarText}>
              {booking.passenger_details?.full_name?.substring(0, 2).toUpperCase() || 'PA'}
            </Text>
          </View>
        )}
        <View style={styles.passengerDetails}>
          <Text style={styles.passengerName}>{booking.passenger_details?.full_name}</Text>
          <Text style={styles.passengerPhone}>{booking.passenger_details?.phone || 'Numéro masqué'}</Text>
          <View style={styles.ratingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginRight: 4 }}>
              <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A', marginLeft: 3 }}>Profil vérifié</Text>
            </View>
            <Text style={styles.seatBadge}>{booking.seats_booked} place(s)</Text>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.passengerActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => {
          const pId = booking.passenger_details?.id;
          if (pId) onMessage(pId);
        }}>
          <Ionicons name="chatbubble-outline" size={20} color="#2F80ED" />
          <Text style={[styles.actionBtnText, { color: '#2F80ED' }]}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onCall(booking.passenger_details?.phone)}>
          <Ionicons name="call-outline" size={20} color="#16A34A" />
          <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>Appeler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  passengerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  passengerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  passengerAvatarText: {
    color: '#2F80ED',
    fontSize: 16,
    fontWeight: '700'
  },
  passengerAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12
  },
  passengerDetails: {
    flex: 1
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2
  },
  passengerPhone: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ratingTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 4,
    marginRight: 8
  },
  seatBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 12,
    color: '#1F2937',
    overflow: 'hidden'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  passengerActions: {
    flexDirection: 'row',
    gap: 12
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600'
  }
});
