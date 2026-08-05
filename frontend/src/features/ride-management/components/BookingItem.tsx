import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking } from '../../../../src/types';
import { getMediaUrl } from '../../../../src/utils/media';

interface BookingItemProps {
  booking: Booking;
  isPendingSection: boolean;
  ridePrice: number;
  onAccept?: () => void;
  onReject?: () => void;
  onBoard?: () => void;
  onMessage: (passengerId: string) => void;
  onCall: (phone?: string) => void;
  onDownloadManifest?: (bookingId: string) => void;
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
      return { text: 'En attente validation passager', color: '#F59E0B', bg: '#FFFBEB' };
    case 'pending_payment':
      return { text: 'En attente de paiement', color: '#F59E0B', bg: '#FFFBEB' };
    case 'payment_processing':
      return { text: 'Paiement en cours', color: '#F59E0B', bg: '#FFFBEB' };
    case 'payment_failed':
      return { text: 'Paiement échoué', color: '#DC2626', bg: '#FEF2F2' };
    case 'payment_refunded':
      return { text: 'Remboursée', color: '#6B7280', bg: '#F3F4F6' };
    case 'started':
      return { text: 'Embarqué', color: '#16A34A', bg: '#F0FDF4' };
    case 'completed':
      return { text: 'Arrivé(e)', color: '#2D9CDB', bg: '#EFF6FF' };
    case 'cancelled':
      return { text: 'Annulée', color: '#DC2626', bg: '#FEF2F2' };
    case 'rejected':
      return { text: 'Rejetée', color: '#DC2626', bg: '#FEF2F2' };
    default:
      return { text: status.toUpperCase(), color: '#6B7280', bg: '#F3F4F6' };
  }
};

export function BookingItem({
  booking,
  isPendingSection,
  ridePrice,
  onAccept,
  onReject,
  onBoard,
  onMessage,
  onCall,
  onDownloadManifest
}: BookingItemProps) {
  const badge = getBookingStatusDisplay(booking.status);
  const finalPrice = booking.portion_price || booking.amount_paid_online || (ridePrice * (booking.seats_booked || 1));

  return (
    <View style={[styles.passengerCard, isPendingSection && { borderColor: '#F59E0B', borderWidth: 1.5 }]}>
      <View style={styles.passengerHeader}>
        {booking.passenger_details?.avatar ? (
          <Image source={{ uri: getMediaUrl(booking.passenger_details.avatar) }} style={styles.passengerAvatarImage} />
        ) : (
          <View style={[styles.passengerAvatar, isPendingSection && { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.passengerAvatarText, isPendingSection && { color: '#D97706' }]}>
              {booking.passenger_details?.full_name?.substring(0, 2).toUpperCase() || 'PA'}
            </Text>
          </View>
        )}
        <View style={styles.passengerDetails}>
          <Text style={styles.passengerName}>{booking.passenger_details?.full_name}</Text>
          <Text style={styles.passengerPhone}>{booking.passenger_details?.phone || 'Numéro masqué'}</Text>
          
          <View style={{ marginTop: 6, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#6B7280' }}>PORTION ET LIEUX DE PASSAGE :</Text>
            <Text style={{ fontSize: 13, color: '#1F2937', fontWeight: '700', marginTop: 2 }}>
              {booking.departure_location?.split(',')[0]} ➔ {booking.arrival_location?.split(',')[0]}
            </Text>
            <View style={{ marginTop: 6, gap: 4 }}>
              {booking.departure_location ? (
                <Text style={{ fontSize: 11, color: '#4B5563', lineHeight: 15 }}>
                  🟢 <Text style={{ fontWeight: '700' }}>Embarquement :</Text> {booking.departure_location}
                </Text>
              ) : null}
              {booking.arrival_location ? (
                <Text style={{ fontSize: 11, color: '#4B5563', lineHeight: 15 }}>
                  🔴 <Text style={{ fontWeight: '700' }}>Débarquement :</Text> {booking.arrival_location}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.ratingRow, { marginTop: 8 }]}>
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

      <View style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>Tarif portion :</Text>
        <Text style={[styles.paymentValue, { color: '#2D9CDB', fontWeight: '800' }]}>
          {finalPrice.toLocaleString()} FCFA
        </Text>
        {!isPendingSection && (
          <View style={[styles.paymentBadge, { backgroundColor: ['confirmed', 'active', 'completed'].includes(booking.status) ? '#F0FDF4' : '#FFFBEB' }]}>
            <Text style={[styles.paymentBadgeText, { color: ['confirmed', 'active', 'completed'].includes(booking.status) ? '#16A34A' : '#F59E0B' }]}>
              {['confirmed', 'active', 'completed'].includes(booking.status) ? 'Payé' : 'En attente'}
            </Text>
          </View>
        )}
      </View>

      {isPendingSection ? (
        <>
          {booking.status === 'pending_passenger' ? (
            <View style={styles.statusBoxAmber}>
              <Ionicons name="time-outline" size={16} color="#D97706" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#B45309' }}>En attente de confirmation du prix par le passager...</Text>
            </View>
          ) : booking.status === 'pending_payment' ? (
            <View style={styles.statusBoxBlue}>
              <ActivityIndicator size="small" color="#2D9CDB" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0369A1' }}>En cours de règlement par le passager...</Text>
            </View>
          ) : (
            <View style={[styles.passengerActions, { marginTop: 12 }]}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#16A34A', borderColor: '#16A34A' }]} 
                onPress={onAccept}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Accepter (OUI)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#DC2626', borderColor: '#DC2626' }]} 
                onPress={onReject}
              >
                <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Refuser (NON)</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <View style={{ gap: 8, width: '100%' }}>
          {!['cancelled', 'rejected', 'payment_failed', 'expired', 'payment_refunded'].includes(booking.status) ? (
            <View style={styles.passengerActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => {
                const pId = booking.passenger_details?.id;
                if (pId) onMessage(pId);
              }}>
                <Ionicons name="chatbubble-outline" size={20} color="#2D9CDB" />
                <Text style={[styles.actionBtnText, { color: '#2D9CDB' }]}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => onCall(booking.passenger_details?.phone)}>
                <Ionicons name="call-outline" size={20} color="#16A34A" />
                <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>Appeler</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!['cancelled', 'rejected', 'payment_failed', 'expired', 'payment_refunded'].includes(booking.status) && onDownloadManifest && (
            <TouchableOpacity 
              style={[styles.actionBtn, { borderColor: '#10B981', flex: 0, width: '100%', height: 44 }]} 
              onPress={() => onDownloadManifest(booking.id)}
            >
              <Ionicons name="document-text-outline" size={20} color="#10B981" />
              <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Télécharger la reconnaissance PDF</Text>
            </TouchableOpacity>
          )}

          {booking.status === 'confirmed' && onBoard && (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#2D9CDB', borderColor: '#2D9CDB', flex: 0, width: '100%', height: 44, marginTop: 4 }]} 
              onPress={onBoard}
            >
              <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Valider l'embarquement (Scan/Code)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  passengerCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  passengerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  passengerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  passengerAvatarText: { color: '#2D9CDB', fontSize: 16, fontWeight: '700' },
  passengerAvatarImage: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  passengerDetails: { flex: 1 },
  passengerName: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  passengerPhone: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingTextSmall: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginLeft: 4, marginRight: 8 },
  seatBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 12, color: '#1F2937' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, marginBottom: 16 },
  paymentLabel: { fontSize: 14, color: '#6B7280', marginRight: 8 },
  paymentValue: { fontSize: 14, fontWeight: '700', color: '#1F2937', flex: 1 },
  paymentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  paymentBadgeText: { fontSize: 12, fontWeight: '700' },
  passengerActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  statusBoxAmber: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, gap: 8, marginTop: 12, borderWidth: 1, borderColor: '#FDE68A' },
  statusBoxBlue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE', padding: 12, borderRadius: 12, gap: 8, marginTop: 12, borderWidth: 1, borderColor: '#BAE6FD' }
});
