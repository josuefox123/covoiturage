import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMediaUrl } from '../../../utils/media';
import { useFadeSlide } from './AnimationsGestion';
import { C, SHsm } from './theme-gestion';

interface PassengerCardProps {
  booking: any;
  onMessage: (passengerId: string) => void;
  onCall: (phone?: string) => void;
  onBoard?: () => void;
  onDownloadManifest?: (bookingId: string) => void;
  downloadingManifestId?: string | null;
}

/**
 * Carte affichant un passager confirmé.
 * Expose les actions Appeler, Message, Ticket et Fiche de réservation.
 */
export function PassengerCard({
  booking,
  onMessage,
  onCall,
  onBoard,
  onDownloadManifest,
  downloadingManifestId
}: PassengerCardProps) {
  const anim = useFadeSlide(320);
  const pax = booking.passenger_details;
  const name = pax?.full_name || 'Passager';
  const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const isBoarded = booking.status === 'started';

  const statusChip = (() => {
    switch (booking.status) {
      case 'confirmed': return { label: 'Confirmé', color: C.success, bg: C.successLight };
      case 'active': return { label: 'Actif', color: C.primary, bg: C.primaryLight };
      case 'started': return { label: 'Embarqué ✓', color: C.success, bg: C.successLight };
      case 'completed': return { label: 'Terminé', color: C.textSec, bg: C.border };
      default: return { label: booking.status, color: C.textSec, bg: C.border };
    }
  })();

  const estPaye = booking.payment_status === 'paid' || booking.payment_status === 'escrow';
  const estAnnulle = ['cancelled', 'rejected', 'expired', 'payment_failed'].includes(booking.status);
  const peutContacter = estPaye && !estAnnulle;

  return (
    <Animated.View style={[styles.paxCard, anim]}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: peutContacter ? 14 : 0 }}>
        {pax?.avatar
          ? <Image source={{ uri: getMediaUrl(pax.avatar) }} style={styles.paxAvatar} />
          : <View style={[styles.paxAvatar, styles.paxAvatarPH]}><Text style={styles.paxInitials}>{initials}</Text></View>
        }
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.paxName}>{name}</Text>
              <View style={styles.verifiedBadge}><Ionicons name="checkmark" size={9} color={C.white} /></View>
            </View>
            <View style={[styles.statusChip, { backgroundColor: statusChip.bg }]}>
              <Text style={[styles.statusChipTxt, { color: statusChip.color }]}>{statusChip.label}</Text>
            </View>
          </View>
          {pax?.phone_number && peutContacter && (
            <Text style={{ fontSize: 12, color: C.textSec }}>{pax.phone_number}</Text>
          )}
          {(booking.departure_location || booking.arrival_location) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.miniDot, { backgroundColor: C.success }]} />
              <Text style={{ fontSize: 11, color: C.textSec }} numberOfLines={1}>
                {booking.departure_location?.split(',')[0]} → {booking.arrival_location?.split(',')[0]}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 12, color: C.primary, fontWeight: '700' }}>
            {((booking.amount_paid_online || 0)).toLocaleString()} FCFA
          </Text>
        </View>
      </View>

      {peutContacter && (
        <View style={styles.paxActions}>
          <TouchableOpacity style={styles.paxActBtn} onPress={() => onCall(pax?.phone_number)} activeOpacity={0.8}>
            <Ionicons name="call" size={16} color={C.success} />
            <Text style={[styles.paxActTxt, { color: C.success }]}>Appeler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.paxActBtn} onPress={() => onMessage(pax?.id)} activeOpacity={0.8}>
            <Ionicons name="chatbubble-ellipses" size={16} color={C.primary} />
            <Text style={[styles.paxActTxt, { color: C.primary }]}>Message</Text>
          </TouchableOpacity>
          {!isBoarded && onBoard && (
            <TouchableOpacity style={[styles.paxActBtn, { backgroundColor: C.warning + '18' }]} onPress={onBoard} activeOpacity={0.8}>
              <Ionicons name="qr-code" size={16} color={C.warning} />
              <Text style={[styles.paxActTxt, { color: C.warning }]}>Ticket</Text>
            </TouchableOpacity>
          )}
          {onDownloadManifest && (
            <TouchableOpacity
              style={[styles.paxActBtn, { backgroundColor: C.primaryLight }]}
              onPress={() => onDownloadManifest(booking.id)}
              disabled={downloadingManifestId === booking.id}
              activeOpacity={0.8}
            >
              {downloadingManifestId === booking.id
                ? <ActivityIndicator size="small" color={C.primary} />
                : <Ionicons name="download-outline" size={16} color={C.primary} />
              }
              <Text style={[styles.paxActTxt, { color: C.primary }]}>Fiche</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  paxCard: { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 14, ...SHsm },
  paxAvatar: { width: 56, height: 56, borderRadius: 28 },
  paxAvatarPH: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  paxInitials: { fontSize: 20, fontWeight: '800', color: C.primary },
  paxName: { fontSize: 16, fontWeight: '800', color: C.text },
  verifiedBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center' },
  miniDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusChipTxt: { fontSize: 11, fontWeight: '700' },
  paxActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  paxActBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  paxActTxt: { fontSize: 12, fontWeight: '700' }
});
