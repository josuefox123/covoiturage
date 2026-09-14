import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, SHsm } from '../composants/theme-trajet';

interface EditRideModalProps {
  visible: boolean;
  ride: any;
  hasPendingBookings?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  authFetch: (url: string, options?: any) => Promise<any>;
}

export function EditRideModal({
  visible,
  ride,
  hasPendingBookings = false,
  onClose,
  onSuccess,
  authFetch,
}: EditRideModalProps) {
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [totalSeats, setTotalSeats] = useState('');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [description, setDescription] = useState('');
  const [acceptsParcels, setAcceptsParcels] = useState(false);
  const [parcelPrice, setParcelPrice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ride && visible) {
      setDepartureDate(ride.departure_date ? String(ride.departure_date) : '');
      setDepartureTime(ride.departure_time ? String(ride.departure_time).substring(0, 5) : '');
      setTotalSeats(ride.total_seats ? String(ride.total_seats) : '4');
      setPricePerSeat(ride.price_per_seat ? String(ride.price_per_seat) : '0');
      setDescription(ride.description || '');
      setAcceptsParcels(!!ride.accepts_parcels);
      setParcelPrice(ride.price_per_parcel ? String(ride.price_per_parcel) : (ride.parcel_price ? String(ride.parcel_price) : ''));
    }
  }, [ride, visible]);

  const handleSave = async () => {
    if (!departureDate || !departureTime || !totalSeats || !pricePerSeat) {
      Alert.alert('Champs requis', 'Veuillez remplir au moins la date, l\'heure, les places et le prix.');
      return;
    }

    const payload: any = {
      departure_date: departureDate,
      departure_time: departureTime,
      total_seats: parseInt(totalSeats, 10),
      price_per_seat: parseInt(pricePerSeat, 10),
      description: description,
      accepts_parcels: acceptsParcels,
    };

    if (acceptsParcels && parcelPrice) {
      payload.price_per_parcel = parseInt(parcelPrice, 10);
      payload.parcel_price = parseInt(parcelPrice, 10);
    }

    setLoading(true);
    try {
      const response = await authFetch(`/api/rides/${ride.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response && response.ok) {
        Alert.alert('Succès', 'Le trajet a été mis à jour avec succès.');
        onSuccess();
        onClose();
      } else {
        const errorData = await response?.json().catch(() => ({}));
        Alert.alert('Erreur', errorData.error || errorData.detail || 'Impossible de modifier le trajet.');
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Problème de connexion lors de la modification.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="create-outline" size={22} color={C.primary} />
              <Text style={styles.title}>Modifier le trajet</Text>
            </View>
            <TouchableOpacity onPress={onClose} padding={4}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Warning pending bookings */}
            {hasPendingBookings && (
              <View style={styles.warningBanner}>
                <Ionicons name="warning-outline" size={20} color="#D97706" />
                <Text style={styles.warningText}>
                  Demandes en attente : valider la modification annulera automatiquement les demandes de réservation non confirmées et en informera les passagers.
                </Text>
              </View>
            )}

            {/* Date & Time */}
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Date de départ (AAAA-MM-JJ)</Text>
                <TextInput
                  style={styles.input}
                  value={departureDate}
                  onChangeText={setDepartureDate}
                  placeholder="2026-09-15"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Heure (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={departureTime}
                  onChangeText={setDepartureTime}
                  placeholder="08:30"
                />
              </View>
            </View>

            {/* Seats & Price */}
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nombre de places</Text>
                <TextInput
                  style={styles.input}
                  value={totalSeats}
                  onChangeText={setTotalSeats}
                  keyboardType="numeric"
                  placeholder="4"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prix par place (FCFA)</Text>
                <TextInput
                  style={styles.input}
                  value={pricePerSeat}
                  onChangeText={setPricePerSeat}
                  keyboardType="numeric"
                  placeholder="5000"
                />
              </View>
            </View>

            {/* Parcels */}
            <View style={styles.parcelRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Accepte les colis</Text>
                <Text style={{ fontSize: 12, color: C.textSec }}>Transport de petits colis ou courriers</Text>
              </View>
              <Switch
                value={acceptsParcels}
                onValueChange={setAcceptsParcels}
                trackColor={{ false: '#CBD5E1', true: C.primaryLight }}
                thumbColor={acceptsParcels ? C.primary : '#F1F5F9'}
              />
            </View>

            {acceptsParcels && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.label}>Prix colis (FCFA)</Text>
                <TextInput
                  style={styles.input}
                  value={parcelPrice}
                  onChangeText={setParcelPrice}
                  keyboardType="numeric"
                  placeholder="2000"
                />
              </View>
            )}

            {/* Description */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Précisions / Note pour les passagers</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Précisions sur le lieu de rendez-vous, bagages admis, etc."
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
  },
  scrollBody: {
    marginVertical: 14,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.textSec,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
  },
  parcelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSec,
  },
  saveBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
