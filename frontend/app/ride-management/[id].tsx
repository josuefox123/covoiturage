import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Animated, RefreshControl, Modal, TextInput, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { CustomAlert } from '../../src/utils/CustomAlert';

// Components & Hooks
import { useRideManagement } from '@/src/features/ride-management/hooks/useRideManagement';
import { RideTimeline } from '@/src/features/ride-management/components/RideTimeline';
import { BookingItem } from '@/src/features/ride-management/components/BookingItem';
import { StatsGrid } from '@/src/features/ride-management/components/StatsGrid';

const COLORS = {
  primary: '#2D9CDB',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  white: '#FFFFFF',
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  grayLight: '#F9FAFB'
};

export default function RideManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, authFetch } = useAuth();
  
  const {
    ride,
    bookings,
    loading,
    refreshing,
    editingBooking,
    customPriceText,
    statusAnim,
    setEditingBooking,
    setCustomPriceText,
    onRefresh,
    handleAcceptBooking,
    handleRejectBooking,
    handleCancelRide,
    handleCompleteRide,
    handleChatWithPassenger,
  } = useRideManagement(id as string, authFetch, user);

  const handleContactPassengers = () => {
    const activeBookings = bookings.filter((b: any) => b.payment_status !== 'pending' && ['confirmed', 'active', 'completed'].includes(b.status));
    if (activeBookings.length === 0) return;
    if (activeBookings.length === 1) {
      const pId = activeBookings[0].passenger_details?.id;
      if (pId) handleChatWithPassenger(pId);
      return;
    }
    
    const options = activeBookings.map((b: any) => ({
      text: b.passenger_details?.full_name || 'Passager',
      onPress: () => {
        const pId = b.passenger_details?.id;
        if (pId) handleChatWithPassenger(pId);
      }
    }));
    options.push({ text: 'Annuler', style: 'cancel' } as any);
    
    CustomAlert.alert(
      'Contacter un passager',
      'Choisissez le passager avec qui vous souhaitez discuter :',
      options
    );
  };

  const handleCallPassenger = (phone?: string) => {
    if (!phone) {
      CustomAlert.alert('Erreur', 'Numéro de téléphone non disponible.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!ride) return null;

  const pendingRequests = bookings.filter((b: any) => ['pending', 'pending_driver', 'pending_passenger', 'pending_payment', 'payment_processing'].includes(b.status));
  const activeBookings = bookings.filter((b: any) => ['confirmed', 'active', 'started', 'completed'].includes(b.status));
  const cancelledBookings = bookings.filter((b: any) => ['cancelled', 'rejected', 'payment_failed', 'expired'].includes(b.status));
  
  const totalRevenue = bookings.filter((b: any) => b.payment_status !== 'pending' && ['confirmed', 'active', 'started', 'completed'].includes(b.status)).reduce((sum: number, b: any) => sum + ((ride.price_per_seat || 0) * (b.seats_booked || 1)), 0);
  const seatsBooked = ride.total_seats - ride.seats_available;

  const getStatusDisplay = () => {
    switch(ride.status) {
      case 'active': return { text: 'EN COURS', color: COLORS.primary, icon: 'car-outline', bg: '#EFF6FF' };
      case 'completed': return { text: 'TERMINÉ', color: COLORS.success, icon: 'checkmark-circle-outline', bg: '#F0FDF4' };
      case 'cancelled': return { text: 'ANNULÉ', color: COLORS.error, icon: 'close-circle-outline', bg: '#FEF2F2' };
      default: return { text: 'EN ATTENTE', color: COLORS.warning, icon: 'time-outline', bg: '#FFFBEB' };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gérer mon trajet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Status Bar */}
        <Animated.View style={[styles.statusBar, { backgroundColor: statusInfo.bg, transform: [{ scale: statusAnim }] }]}>
          <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
        </Animated.View>

        {/* Timeline Trajet */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mon trajet</Text>
          <RideTimeline ride={ride} />

          <View style={styles.divider} />
          
          <View style={styles.rideMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.textLight} />
              <Text style={styles.metaText}>{ride.departure_date}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={18} color={COLORS.textLight} />
              <Text style={styles.metaText}>{ride.seats_available} / {ride.total_seats} places</Text>
            </View>
          </View>
          {ride.description ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>"{ride.description}"</Text>
            </>
          ) : null}
        </View>

        {/* Stats Grid */}
        <StatsGrid ride={ride} totalRevenue={totalRevenue} seatsBooked={seatsBooked} />

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { color: COLORS.warning }]}>Demandes de réservation ({pendingRequests.length})</Text>
            {pendingRequests.map((booking) => (
              <BookingItem
                key={booking.id}
                booking={booking}
                isPendingSection={true}
                ridePrice={ride.price_per_seat}
                onAccept={() => {
                  setEditingBooking(booking);
                  const initialPrice = booking.portion_price ? Math.round(booking.portion_price / booking.seats_booked) : (ride?.price_per_seat || 0);
                  setCustomPriceText(String(initialPrice));
                }}
                onReject={() => handleRejectBooking(booking.id)}
                onMessage={handleChatWithPassenger}
                onCall={handleCallPassenger}
              />
            ))}
          </>
        )}

        {/* Passengers */}
        <Text style={styles.sectionHeader}>Passagers ({activeBookings.length})</Text>
        
        {activeBookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people" size={40} color={COLORS.border} />
            <Text style={styles.emptyText}>Aucun passager pour l'instant</Text>
          </View>
        ) : (
          activeBookings.map((booking) => (
            <BookingItem
              key={booking.id}
              booking={booking}
              isPendingSection={false}
              ridePrice={ride.price_per_seat}
              onMessage={handleChatWithPassenger}
              onCall={handleCallPassenger}
            />
          ))
        )}

        {/* Cancelled Bookings */}
        {cancelledBookings.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Réservations annulées ({cancelledBookings.length})</Text>
            {cancelledBookings.map((booking) => (
              <BookingItem
                key={booking.id}
                booking={booking}
                isPendingSection={false}
                ridePrice={ride.price_per_seat}
                onMessage={handleChatWithPassenger}
                onCall={handleCallPassenger}
              />
            ))}
          </>
        )}

        {/* Preferences & Vehicle Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Véhicule & Préférences</Text>
          
          {ride.driver_details?.vehicles && ride.driver_details.vehicles.length > 0 ? (
            <View style={styles.vehicleDetailsRow}>
              <Ionicons name="car-sport-outline" size={24} color={COLORS.primary} />
              <View style={styles.vehicleTextContainer}>
                <Text style={styles.vehicleModelText}>
                  {ride.driver_details.vehicles[0].brand_model}
                </Text>
                <Text style={styles.vehiclePlateText}>
                  Couleur : {ride.driver_details.vehicles[0].color} • Immatriculation : {ride.driver_details.vehicles[0].license_plate}
                </Text>
                <Text style={styles.vehicleTypeText}>
                  Type : {ride.driver_details.vehicles[0].vehicle_type.toUpperCase()}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.vehicleDetailsRow}>
              <Ionicons name="car-outline" size={24} color={COLORS.textLight} />
              <View style={styles.vehicleTextContainer}>
                <Text style={styles.noVehicleText}>Aucun véhicule enregistré dans le profil.</Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {ride.driver_details?.preference ? (
            <View style={styles.preferencesSection}>
              <Text style={styles.subSectionTitle}>Préférences de voyage</Text>
              <View style={styles.prefTagsContainer}>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>{ride.driver_details.preference.music ? "Musique autorisée" : "Pas de musique"}</Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>{ride.driver_details.preference.smoking ? "Fumeur" : "Non-fumeur"}</Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>{ride.driver_details.preference.chatty ? "Discussion" : "Calme"}</Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>{ride.driver_details.preference.air_conditioner ? "Climatisation" : "Pas de clim"}</Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>{ride.driver_details.preference.pets_allowed ? "Animaux admis" : "Sans animaux"}</Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>{ride.driver_details.preference.luggage_allowed ? "Bagages admis" : "Bagages limités"}</Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>{ride.driver_details.preference.stops_allowed ? "Arrêts possibles" : "Direct (sans arrêts)"}</Text>
                </View>
              </View>
              {ride.driver_details.preference.notes ? (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes complémentaires :</Text>
                  <Text style={styles.notesText}>"{ride.driver_details.preference.notes}"</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noVehicleText}>Aucune préférence enregistrée dans le profil.</Text>
          )}
        </View>

        {/* Main Actions */}
        {ride.status === 'active' && (
          <View style={styles.mainActions}>
            <TouchableOpacity style={styles.btnSuccess} onPress={handleCompleteRide} activeOpacity={0.8}>
              <Ionicons name="checkmark-done" size={22} color={COLORS.white} />
              <Text style={styles.btnSuccessText}>Terminer le trajet</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnDanger} onPress={handleCancelRide} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={COLORS.error} />
              <Text style={styles.btnDangerText}>Annuler le trajet</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={{ height: 80 + insets.bottom }} />
      </ScrollView>

      {/* Floating Action Button */}
      {activeBookings.length > 0 && ride.status === 'active' && (
        <View style={[styles.fabContainer, { bottom: Math.max(24, insets.bottom + 8) }]}>
          <TouchableOpacity style={styles.fab} onPress={handleContactPassengers} activeOpacity={0.9}>
            <Ionicons name="chatbubbles" size={20} color={COLORS.white} />
            <Text style={styles.fabText}>Contacter les passagers</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal d'édition du tarif */}
      <Modal
        visible={editingBooking !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingBooking(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 }}>
              Ajuster le tarif de la portion
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 16, lineHeight: 18 }}>
              Modifiez le tarif proposé par place pour ce voyage de {editingBooking?.departure_location?.split(',')[0]} vers {editingBooking?.arrival_location?.split(',')[0]}. Le passager devra valider ce montant lors de son paiement.
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, height: 54, marginBottom: 20 }}>
              <TextInput
                style={{ flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.text }}
                value={customPriceText}
                onChangeText={setCustomPriceText}
                keyboardType="numeric"
                placeholder="Ex: 1500"
              />
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.textLight }}>FCFA / place</Text>
            </View>

            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={[styles.btnSuccess, { height: 48, width: '100%', marginHorizontal: 0, marginVertical: 0 }]}
                onPress={() => {
                  const price = parseInt(customPriceText);
                  if (isNaN(price) || price <= 0) {
                    CustomAlert.alert("Erreur", "Veuillez entrer un prix valide supérieur à 0.");
                  } else {
                    handleAcceptBooking(editingBooking!.id, price);
                  }
                }}
              >
                <Text style={styles.btnSuccessText}>Accepter avec ce prix</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ height: 48, width: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border }}
                onPress={() => setEditingBooking(null)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.textLight }}>Retour</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    backgroundColor: COLORS.white, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { padding: 16 },
  
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 8, 
    elevation: 3 
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 8, marginBottom: 12, marginLeft: 4 },

  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginBottom: 16, gap: 8 },
  statusText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: COLORS.grayLight, marginVertical: 12 },
  
  rideMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  emptyState: { backgroundColor: COLORS.white, padding: 32, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
  emptyText: { color: COLORS.textLight, marginTop: 12, fontSize: 15 },
  subSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  // Vehicle Info Styles
  vehicleDetailsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 4 },
  vehicleTextContainer: { flex: 1, gap: 4 },
  vehicleModelText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  vehiclePlateText: { fontSize: 13, color: COLORS.textLight },
  vehicleTypeText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textTransform: 'uppercase' },
  noVehicleText: { fontSize: 14, color: COLORS.textLight, fontStyle: 'italic' },

  // Preferences Styles
  preferencesSection: { paddingHorizontal: 4 },
  prefTagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  prefTagItem: { backgroundColor: COLORS.grayLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  prefTagText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  notesContainer: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginTop: 8 },
  notesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  notesText: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },

  mainActions: { marginTop: 8, gap: 16 },
  btnSuccess: { flexDirection: 'row', backgroundColor: COLORS.success, padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: COLORS.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnSuccessText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  btnDanger: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FECACA' },
  btnDangerText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },

  fabContainer: { position: 'absolute', bottom: 24, left: 16, right: 16, alignItems: 'center' },
  fab: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  fabText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  descriptionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  descriptionText: { fontSize: 14, color: COLORS.textLight, fontStyle: 'italic', lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: COLORS.white, borderRadius: 24, padding: 20, maxHeight: '85%' },
});
