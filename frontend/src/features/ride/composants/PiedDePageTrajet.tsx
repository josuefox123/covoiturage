import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlert } from '../../../utils/CustomAlert';
import { C, SHmd } from './theme-trajet';

interface PiedDePageTrajetProps {
  prixParPlace: number | undefined;
  isMid: boolean;
  canChat: boolean;
  chatLoading: boolean;
  isOwnRide: boolean;
  myBooking: any;
  paddingBottom: number;
  onOpenChat: () => void;
  children: React.ReactNode; // Le BoutonReservation
}

/**
 * Pied de page fixe de l'écran détail trajet.
 * Affiche le prix, le bouton chat et le bouton de réservation.
 */
export function PiedDePageTrajet({
  prixParPlace,
  isMid,
  canChat,
  chatLoading,
  isOwnRide,
  myBooking,
  paddingBottom,
  onOpenChat,
  children,
}: PiedDePageTrajetProps) {
  const handleChat = () => {
    if (isOwnRide) {
      onOpenChat();
    } else if (myBooking && (myBooking.payment_status === 'paid' || myBooking.payment_status === 'escrow')) {
      onOpenChat();
    } else if (myBooking) {
      CustomAlert.alert('Messagerie', 'Veuillez payer votre réservation pour discuter avec le conducteur.');
    } else {
      CustomAlert.alert('Messagerie', 'Réservez ce trajet pour discuter.');
    }
  };

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(16, paddingBottom + 8) }]}>
      {/* Prix */}
      <View style={{ minWidth: 90, paddingRight: 4 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>
            {prixParPlace?.toLocaleString() ?? '0'}
          </Text>
          <Text style={{ fontSize: 13, color: C.textSec, fontWeight: '700' }}> FCFA</Text>
        </Text>
        <Text style={{ fontSize: 11, color: C.textSec, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit>
          par place
        </Text>
      </View>

      {/* Bouton Chat */}
      <TouchableOpacity
        style={[styles.chatFootBtn, !canChat && { opacity: 0.4 }]}
        onPress={handleChat}
        disabled={chatLoading}
        activeOpacity={0.8}
      >
        {chatLoading
          ? <ActivityIndicator color={C.primary} size="small" />
          : <Ionicons name="chatbubble-ellipses" size={22} color={C.primary} />
        }
      </TouchableOpacity>

      {/* Bouton Réservation (passé en children) */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    ...SHmd
  },
  chatFootBtn: {
    width: 48, height: 48, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.primary + '40',
    backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center'
  }
});
