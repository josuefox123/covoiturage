import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C, SHsm } from './theme-trajet';

interface CarteBilletProps {
  myBooking: any;
  ride: any;
}

/**
 * Carte de billet de voyage payé — affiche le numéro de ticket
 * et un bouton pour afficher le QR code.
 */
export function CarteBillet({ myBooking, ride }: CarteBilletProps) {
  const router = useRouter();

  if (!myBooking || (myBooking.payment_status !== 'paid' && myBooking.payment_status !== 'escrow')) {
    return null;
  }

  return (
    <View style={[styles.carte, { borderColor: C.primaryLight, borderWidth: 1.5 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="qr-code-outline" size={20} color={C.primary} />
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Votre Billet de Voyage</Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>
          T-{myBooking.id.substring(0, 8).toUpperCase()}
        </Text>
      </View>

      <Text style={{ fontSize: 13, color: C.textSec, marginBottom: 12 }}>
        Votre réservation est payée et validée. Présentez ce billet au conducteur lors de la montée.
      </Text>

      <TouchableOpacity
        style={{ backgroundColor: C.primaryLight, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
        onPress={() => router.push({
          pathname: '/payment/success',
          params: {
            booking_id: myBooking.id,
            amount: String(myBooking.portion_price || ride?.price_per_seat || 0)
          }
        })}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary }}>Afficher le QR Code & Billet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, ...SHsm }
});
