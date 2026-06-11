import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/styles/theme';
import { fetchApi } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { Ride, Booking } from '../../src/types';
import { CustomAlert } from '../../src/utils/CustomAlert';

export default function RideManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, authFetch } = useAuth();
  
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rideData, bookingsData] = await Promise.all([
        authFetch(`/rides/${id}/`),
        authFetch(`/bookings/?ride=${id}`)
      ]);
      setRide(rideData);
      setBookings(bookingsData);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de charger le trajet.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = () => {
    CustomAlert.alert(
      'Annuler le trajet',
      'Êtes-vous sûr de vouloir annuler ce trajet ? Tous les passagers seront notifiés.',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, annuler', 
          style: 'destructive',
          onPress: async () => {
            try {
              await authFetch(`/rides/${id}/cancel/`, { method: 'POST' });
              CustomAlert.alert('Succès', 'Le trajet a été annulé.');
              router.back();
            } catch (error: any) {
              CustomAlert.alert('Erreur', error.message || 'Impossible d\'annuler le trajet.');
            }
          }
        }
      ]
    );
  };

  const handleCompleteRide = () => {
    CustomAlert.alert(
      'Terminer le trajet',
      'Avez-vous terminé ce trajet ?',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, terminé', 
          onPress: async () => {
            try {
              await authFetch(`/rides/${id}/complete/`, { method: 'POST' });
              CustomAlert.alert('Succès', 'Le trajet est marqué comme terminé.');
              router.back();
            } catch (error: any) {
              CustomAlert.alert('Erreur', error.message || 'Impossible de terminer le trajet.');
            }
          }
        }
      ]
    );
  };

  const handleChatPassenger = async (passengerId: string) => {
    try {
      const response = await authFetch('/conversations/ride-chat/', {
        method: 'POST',
        body: JSON.stringify({ ride_id: id }),
      });
      // La création/récupération crée un chat entre conducteur et passager. 
      // Si la route `ride-chat` par défaut utilise le user courant et le driver, 
      // on doit faire attention car ici le user est le driver. 
      // Wait, let's just go to the conversation if it exists.
      router.push(`/chat/${response.id}`);
    } catch (error: any) {
      CustomAlert.alert('Erreur', 'Impossible d\'ouvrir la discussion.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!ride) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Gérer le trajet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.routeText}>{ride.departure_location} → {ride.arrival_location}</Text>
          <Text style={styles.dateText}>{ride.departure_date} à {ride.departure_time?.substring(0, 5)}</Text>
          <Text style={styles.statusText}>
            Statut : <Text style={styles.statusValue}>{ride.status === 'active' ? 'En cours' : ride.status === 'completed' ? 'Terminé' : 'Annulé'}</Text>
          </Text>
          <Text style={styles.seatsText}>
            Places restantes : {ride.seats_available} / {ride.total_seats}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Passagers ({bookings.filter(b => b.status === 'confirmed').length})</Text>
        {bookings.filter(b => b.status === 'confirmed').map((booking) => (
          <View key={booking.id} style={styles.passengerCard}>
            <View style={styles.passengerInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {booking.passenger_details?.full_name?.substring(0,2).toUpperCase() || 'PA'}
                </Text>
              </View>
              <View>
                <Text style={styles.passengerName}>{booking.passenger_details?.full_name}</Text>
                <Text style={styles.passengerSeats}>{booking.seats_booked} place(s)</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.chatButton}
              onPress={() => handleChatPassenger(booking.passenger)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        ))}

        {bookings.length === 0 && (
          <Text style={styles.emptyText}>Aucun passager pour l'instant.</Text>
        )}

        {ride.status === 'active' && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteRide}>
              <Text style={styles.completeBtnText}>Terminer le trajet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRide}>
              <Text style={styles.cancelBtnText}>Annuler le trajet</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: theme.colors.white, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backButton: { padding: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
  content: { padding: 16 },
  card: { backgroundColor: theme.colors.white, borderRadius: 12, padding: 16, marginBottom: 24, shadowColor: theme.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  routeText: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  dateText: { fontSize: 14, color: theme.colors.textLight, marginBottom: 4 },
  statusText: { fontSize: 14, color: theme.colors.textLight, marginBottom: 4 },
  statusValue: { fontWeight: 'bold', color: theme.colors.primary },
  seatsText: { fontSize: 14, fontWeight: '600', color: theme.colors.success },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  passengerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.white, padding: 12, borderRadius: 12, marginBottom: 12 },
  passengerInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: theme.colors.primaryDark, fontWeight: 'bold' },
  passengerName: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  passengerSeats: { fontSize: 12, color: theme.colors.textLight },
  chatButton: { padding: 8, backgroundColor: theme.colors.background, borderRadius: 20 },
  emptyText: { textAlign: 'center', color: theme.colors.textLight, fontStyle: 'italic', marginBottom: 24 },
  actions: { marginTop: 24, gap: 12 },
  completeBtn: { backgroundColor: theme.colors.success, padding: 16, borderRadius: 12, alignItems: 'center' },
  completeBtnText: { color: theme.colors.white, fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { backgroundColor: theme.colors.white, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.error },
  cancelBtnText: { color: theme.colors.error, fontSize: 16, fontWeight: 'bold' },
});
