import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BookingSuccessModalProps {
  visible: boolean;
  driverName: string;
  onClose: () => void;
}

export function BookingSuccessModal({ visible, driverName, onClose }: BookingSuccessModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { maxHeight: 340, padding: 24, alignItems: 'center', justifyContent: 'center' }]}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, padding: 4 }}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>

          <Ionicons name="checkmark-circle" size={64} color="#16A34A" style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8, textAlign: 'center' }}>
            Demande envoyée !
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            Votre demande a été transmise à {driverName}. Vous recevrez une notification dès que le trajet sera accepté pour procéder au paiement.
          </Text>
          <TouchableOpacity
            style={[styles.bookBtn, { width: '100%', backgroundColor: '#2F80ED' }]}
            onPress={onClose}
          >
            <Text style={styles.bookBtnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 500
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
