import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking } from '../../../../src/types';

interface PassengerNegotiationModalProps {
  visible: boolean;
  myBooking: Booking | null;
  driverName: string;
  departure?: string;
  destination?: string;
  bookingLoading: boolean;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
}

export function PassengerNegotiationModal({
  visible,
  myBooking,
  driverName,
  departure,
  destination,
  bookingLoading,
  onClose,
  onAccept,
  onReject
}: PassengerNegotiationModalProps) {
  // Prix chauffeur unitaire proposé ou contre-proposé
  const unitPrice = myBooking?.driver_counter_price || myBooking?.passenger_proposed_price || myBooking?.custom_price || 0;
  const totalAmount = myBooking?.portion_price || myBooking?.amount_paid_online || 0;

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
            <Text style={styles.modalTitle}>Proposition de tarif reçue !</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
              Le conducteur {driverName} propose un tarif personnalisé pour votre portion de voyage :
            </Text>

            {/* Portion recap */}
            <View style={{ backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 4 }}>
                VOTRE COVOITURAGE ({myBooking?.seats_booked} place{myBooking && myBooking.seats_booked > 1 ? 's' : ''})
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                {myBooking?.departure_location || departure} → {myBooking?.arrival_location || destination}
              </Text>
            </View>

            {/* Price card details */}
            <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A', borderRadius: 16, padding: 16, marginBottom: 24, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#6B7280' }}>Tarif unitaire négocié :</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
                  {unitPrice.toLocaleString()} FCFA / place
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#6B7280' }}>Nombre de places :</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
                  x {myBooking?.seats_booked}
                </Text>
              </View>

              {Boolean(myBooking?.pricing_breakdown?.zemy_amount) && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#6B7280' }}>Frais Zemy :</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
                    +{myBooking?.pricing_breakdown?.zemy_amount?.toLocaleString()} FCFA
                  </Text>
                </View>
              )}

              <View style={{ height: 1, backgroundColor: '#FDE68A', marginVertical: 4 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#B45309' }}>MONTANT TOTAL A PAYER :</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#D97706' }}>
                  {totalAmount.toLocaleString()} FCFA
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#B45309', fontStyle: 'italic', textAlign: 'right' }}>
                (incluant la commission de service Zemy)
              </Text>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.bookBtn, { width: '100%', marginBottom: 12, backgroundColor: '#16A34A' }]}
              onPress={onAccept}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.bookBtnText}>ACCEPTER & PAYER (OUI)</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bookBtn, { width: '100%', backgroundColor: '#DC2626', marginBottom: 12 }]}
              onPress={onReject}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="close-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.bookBtnText}>DÉCLINER (NON)</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bookBtn, { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }]}
              onPress={onClose}
            >
              <Text style={[styles.bookBtnText, { color: '#6B7280' }]}>RETOUR</Text>
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
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  }
});
