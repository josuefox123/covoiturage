import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../../src/types';

interface BookingConfirmModalProps {
  visible: boolean;
  ride: Ride;
  departure?: string;
  destination?: string;
  bookingLoading: boolean;
  pricePerSeat?: number; // Prix par place avec frais Zemy inclus (depuis le backend)
  onClose: () => void;
  onConfirm: (seats: number, customPrice?: number, message?: string) => void;
}

export function BookingConfirmModal({
  visible,
  ride,
  departure,
  destination,
  bookingLoading,
  pricePerSeat,
  onClose,
  onConfirm
}: BookingConfirmModalProps) {
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // â”€â”€ NÃ‰GOCIATION DÃ‰SACTIVÃ‰E â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // const [proposeCustomPrice, setProposeCustomPrice] = useState(false);
  // const [proposedPriceText, setProposedPriceText] = useState('');
  // const [passengerMessageText, setPassengerMessageText] = useState('');
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Reset state when modal visibility changes
  React.useEffect(() => {
    if (!visible) {
      setSubmitting(false);
      setSeatsToBook(1);
    }
  }, [visible]);

  const displayPrice = pricePerSeat ?? ride?.price_per_seat ?? 0;
  const totalToPay = displayPrice * seatsToBook;

  const handleConfirm = async () => {
    if (submitting || bookingLoading) return;
    setSubmitting(true);
    try {
      // Plus de nÃ©gociation : on confirme directement avec le prix affichÃ©
      await onConfirm(seatsToBook, undefined, undefined);
    } catch (e) {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Réserver ce trajet</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>

            {/* Récapitulatif portion */}
            <View style={{ backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 4 }}>
                PORTION S{'\u00c9'}LECTIONN{'\u00c9'}E
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 12 }} numberOfLines={2}>
                {departure || ride?.departure_location}{' \u2192 '}{destination || ride?.arrival_location}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people-outline" size={18} color="#2F80ED" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#2F80ED' }}>
                  {ride ? ride.seats_available : 0} places disponibles
                </Text>
              </View>
            </View>

            {/* Sélecteur de places */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>Nombre de places</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity
                  onPress={() => setSeatsToBook(prev => Math.max(1, prev - 1))}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2937' }}>-</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F2937', minWidth: 20, textAlign: 'center' }}>
                  {seatsToBook}
                </Text>
                <TouchableOpacity
                  onPress={() => setSeatsToBook(prev => Math.min(ride ? ride.seats_available : 1, prev + 1))}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#2F80ED', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Récapitulatif du prix */}
            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1.5, borderColor: '#BFDBFE' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: '#4B5563' }}>Prix par place</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
                  {displayPrice.toLocaleString()} FCFA
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: '#4B5563' }}>Nombre de places</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
                  {'\u00d7'} {seatsToBook}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: '#BFDBFE', marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E40AF' }}>TOTAL {'\u00c0'} PAYER</Text>
                  <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Frais Zemy inclus</Text>
                </View>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#2F80ED' }}>
                  {totalToPay.toLocaleString()} FCFA
                </Text>
              </View>
            </View>

            {/* â”€â”€ NÃ‰GOCIATION DÃ‰SACTIVÃ‰E â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 10 }}>
                Souhaitez-vous proposer un prix ?
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setProposeCustomPrice(false)} ...>
                  <Text>NON</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setProposeCustomPrice(true)} ...>
                  <Text>OUI</Text>
                </TouchableOpacity>
              </View>
              {proposeCustomPrice && (
                <TextInput keyboardType="numeric" placeholder="Ex: 700 FCFA" ... />
              )}
            </View>
            <View style={{ marginBottom: 24 }}>
              <Text ...>Message (facultatif)</Text>
              <TextInput multiline placeholder="Ã‰crivez un message pour le chauffeur..." ... />
            </View>
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

            {/* Bouton PAYER */}
            <TouchableOpacity
              style={[
                styles.bookBtn,
                { width: '100%', marginBottom: 12, backgroundColor: '#2F80ED' },
                (submitting || bookingLoading) && { opacity: 0.65 }
              ]}
              onPress={handleConfirm}
              disabled={submitting || bookingLoading}
              activeOpacity={0.8}
            >
              {submitting || bookingLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.bookBtnText}>TRAITEMENT...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Ionicons name="card" size={18} color="#FFFFFF" />
                  <Text style={styles.bookBtnText}>PAYER {totalToPay.toLocaleString()} FCFA</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bookBtn, { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }]}
              onPress={onClose}
            >
              <Text style={[styles.bookBtnText, { color: '#6B7280' }]}>ANNULER</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937'
  },
  modalScroll: {
    paddingBottom: 24
  },
  bookBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bookBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
