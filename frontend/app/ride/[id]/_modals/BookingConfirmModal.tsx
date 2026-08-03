import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../../src/types';

interface BookingConfirmModalProps {
  visible: boolean;
  ride: Ride;
  departure?: string;
  destination?: string;
  bookingLoading: boolean;
  onClose: () => void;
  onConfirm: (seats: number, customPrice?: number, message?: string) => void;
}

export function BookingConfirmModal({
  visible,
  ride,
  departure,
  destination,
  bookingLoading,
  onClose,
  onConfirm
}: BookingConfirmModalProps) {
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [proposeCustomPrice, setProposeCustomPrice] = useState(false);
  const [proposedPriceText, setProposedPriceText] = useState('');
  const [passengerMessageText, setPassengerMessageText] = useState('');

  const handleConfirm = () => {
    const customPrice = proposeCustomPrice && proposedPriceText ? parseInt(proposedPriceText) : undefined;
    onConfirm(seatsToBook, customPrice, passengerMessageText);
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
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
              Veuillez configurer vos options de réservation ci-dessous.
            </Text>

            <View style={{ backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 4 }}>
                PORTION SÉLECTIONNÉE
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 12 }} numberOfLines={2}>
                {departure || ride?.departure_location} → {destination || ride?.arrival_location}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="people-outline" size={18} color="#2F80ED" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#2F80ED' }}>
                  {ride ? ride.seats_available : 0} places disponibles
                </Text>
              </View>
            </View>

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

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>TOTAL :</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#2F80ED' }}>
                {((ride?.price_per_seat || 0) * seatsToBook).toLocaleString()} FCFA
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 10 }}>
                Souhaitez-vous proposer un autre prix ?
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setProposeCustomPrice(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: !proposeCustomPrice ? '#2F80ED' : '#CBD5E1',
                    backgroundColor: !proposeCustomPrice ? '#EFF6FF' : '#FFFFFF',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ fontWeight: '700', color: !proposeCustomPrice ? '#2F80ED' : '#6B7280' }}>NON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setProposeCustomPrice(true)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: proposeCustomPrice ? '#2F80ED' : '#CBD5E1',
                    backgroundColor: proposeCustomPrice ? '#EFF6FF' : '#FFFFFF',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ fontWeight: '700', color: proposeCustomPrice ? '#2F80ED' : '#6B7280' }}>OUI</Text>
                </TouchableOpacity>
              </View>

              {proposeCustomPrice && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
                    Votre proposition (par place)
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 15,
                      color: '#1F2937',
                      backgroundColor: '#F8FAFC'
                    }}
                    keyboardType="numeric"
                    placeholder="Ex: 700 FCFA"
                    value={proposedPriceText}
                    onChangeText={setProposedPriceText}
                  />
                </View>
              )}
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 8 }}>
                Message (facultatif)
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  color: '#1F2937',
                  backgroundColor: '#F8FAFC',
                  minHeight: 80,
                  textAlignVertical: 'top'
                }}
                placeholder="Écrivez un message pour le chauffeur..."
                multiline={true}
                numberOfLines={3}
                value={passengerMessageText}
                onChangeText={setPassengerMessageText}
              />
            </View>

            <TouchableOpacity
              style={[styles.bookBtn, { width: '100%', marginBottom: 12, backgroundColor: '#2F80ED' }]}
              onPress={handleConfirm}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.bookBtnText}>CONTINUER</Text>
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
