import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMediaUrl } from '../../../utils/media';
import { useFadeSlide } from './AnimationsGestion';
import { C, SHsm } from './theme-gestion';

interface PendingBookingCardProps {
  booking: any;
  ridePrice: number;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Carte affichant une demande de réservation en attente d'approbation.
 * Permet au conducteur d'accepter ou de rejeter la demande.
 */
export function PendingBookingCard({
  booking,
  ridePrice,
  onAccept,
  onReject,
}: PendingBookingCardProps) {
  const anim = useFadeSlide(280);
  const pax = booking.passenger_details;
  const name = pax?.full_name || 'Passager';
  const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const seatsReq = booking.seats_booked || 1;
  const price = booking.portion_price ? Math.round(booking.portion_price / seatsReq) : ridePrice || 0;

  const isPendingPayment = ['pending_payment', 'pending_passenger', 'payment_processing'].includes(booking.status);

  return (
    <Animated.View style={[styles.bookCard, anim]}>
      {/* Badge En attente */}
      <View style={[styles.pendingBadge, { backgroundColor: isPendingPayment ? C.primaryLight : C.warningLight }]}>
        <View style={[styles.pendingDot, { backgroundColor: isPendingPayment ? C.primary : C.warning }]} />
        <Text style={[styles.pendingTxt, { color: isPendingPayment ? C.primary : C.warning }]}>
          {isPendingPayment ? 'En attente de paiement' : 'Demande en attente'}
        </Text>
      </View>

      {/* Profil du passager */}
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
        {pax?.avatar
          ? <Image source={{ uri: getMediaUrl(pax.avatar) }} style={styles.paxAvatar} />
          : <View style={[styles.paxAvatar, styles.paxAvatarPH]}><Text style={styles.paxInitials}>{initials}</Text></View>
        }
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.paxName}>{name}</Text>
            <View style={styles.verifiedBadge}><Ionicons name="checkmark" size={9} color={C.white} /></View>
          </View>
          <Text style={{ fontSize: 12, color: C.textSec }}>
            {seatsReq} place{seatsReq > 1 ? 's' : ''} demandée{seatsReq > 1 ? 's' : ''}
          </Text>
          {(booking.departure_location || booking.arrival_location) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <View style={[styles.miniDot, { backgroundColor: C.success }]} />
              <Text style={{ fontSize: 11, color: C.textSec, flex: 1 }} numberOfLines={1}>
                {booking.departure_location?.split(',')[0]} → {booking.arrival_location?.split(',')[0]}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <Text style={styles.paxPrice}>{(price * seatsReq).toLocaleString()}</Text>
          <Text style={{ fontSize: 11, color: C.textSec, fontWeight: '600' }}>FCFA</Text>
        </View>
      </View>

      {/* Action / Statut */}
      {isPendingPayment ? (
        <View style={styles.waitingBox}>
          <Ionicons name="time-outline" size={18} color={C.primary} />
          <Text style={styles.waitingTxt}>Acceptée • En attente de paiement par le passager</Text>
        </View>
      ) : (
        <View style={styles.bookBtns}>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.85}>
            <Ionicons name="close" size={17} color={C.error} />
            <Text style={styles.rejectTxt}>Refuser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={17} color={C.white} />
            <Text style={styles.acceptTxt}>Accepter</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bookCard: { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 14, ...SHsm },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
  pendingDot: { width: 7, height: 7, borderRadius: 3.5 },
  pendingTxt: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  paxAvatar: { width: 56, height: 56, borderRadius: 28 },
  paxAvatarPH: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  paxInitials: { fontSize: 20, fontWeight: '800', color: C.primary },
  paxName: { fontSize: 16, fontWeight: '800', color: C.text },
  paxPrice: { fontSize: 18, fontWeight: '900', color: C.primary },
  verifiedBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center' },
  miniDot: { width: 7, height: 7, borderRadius: 3.5 },
  waitingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primaryLight, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  waitingTxt: { fontSize: 13, fontWeight: '600', color: C.primary, flex: 1 },
  bookBtns: { flexDirection: 'row', gap: 12 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.error + '40', backgroundColor: C.errorLight, borderRadius: 16, paddingVertical: 13 },
  rejectTxt: { fontSize: 14, fontWeight: '700', color: C.error },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.success, borderRadius: 16, paddingVertical: 13, ...SHsm },
  acceptTxt: { fontSize: 14, fontWeight: '700', color: C.white }
});
