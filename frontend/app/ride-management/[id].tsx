import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Animated, RefreshControl, Modal, TextInput, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_URL } from '@/src/services/api';

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

  const [showScanner, setShowScanner] = React.useState(false);
  const [scanned, setScanned] = React.useState(false);
  const [manualCode, setManualCode] = React.useState('');
  const [showCodeInputModal, setShowCodeInputModal] = React.useState(false);
  const [selectedBookingForManualCode, setSelectedBookingForManualCode] = React.useState<any>(null);
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const handleBoardWithCode = async (bookingId: string) => {
    if (!selectedBookingForManualCode) return;
    
    const cleanCode = manualCode.trim().replace('T-', '').toUpperCase();
    const expectedPrefix = selectedBookingForManualCode.id.substring(0, 8).toUpperCase();
    const fullIdMatch = manualCode.trim() === selectedBookingForManualCode.id;
    
    if (cleanCode !== expectedPrefix && !fullIdMatch) {
      CustomAlert.alert('Code incorrect', 'Le code saisi ne correspond pas à ce passager.');
      return;
    }

    try {
      await authFetch(`/bookings/${bookingId}/board/`, {
        method: 'POST'
      });
      CustomAlert.alert('Succès', 'Embarquement validé avec succès !');
      setShowCodeInputModal(false);
      setManualCode('');
      setSelectedBookingForManualCode(null);
      await onRefresh();
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || "Impossible de valider l'embarquement.");
    }
  };

  const [downloadingManifestId, setDownloadingManifestId] = React.useState<string | null>(null);

  const handleDownloadManifest = async (bookingId: string) => {
    try {
      setDownloadingManifestId(bookingId);
      const FileSystem = require('expo-file-system/legacy');
      const Sharing = require('expo-sharing');
      const SecureStore = require('expo-secure-store');

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        CustomAlert.alert('Non disponible', "Le partage de fichiers n'est pas disponible sur cet appareil.");
        return;
      }

      const storedToken = await SecureStore.getItemAsync('zemy_access_token');
      const manifestUrl = `${API_URL}/bookings/${bookingId}/manifest/`;
      const localUri = (((FileSystem as any).documentDirectory) ?? '') + `reconnaissance_reservation_${bookingId.substring(0, 8)}.pdf`;

      const downloadResult = await FileSystem.downloadAsync(manifestUrl, localUri, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });

      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Reconnaissance de réservation Zemy',
          UTI: 'com.adobe.pdf',
        });
      } else {
        CustomAlert.alert('Erreur', 'Impossible de télécharger le document. Veuillez réessayer.');
      }
    } catch (e: any) {
      console.error('Erreur téléchargement reconnaissance:', e);
      CustomAlert.alert('Erreur', 'Impossible de générer la reconnaissance. Veuillez réessayer.');
    } finally {
      setDownloadingManifestId(null);
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    let bookingId = '';
    let passengerName = 'le passager';
    try {
      const parsed = JSON.parse(data);
      if (parsed.booking) {
        bookingId = parsed.booking;
        passengerName = parsed.passenger || 'le passager';
      } else {
        bookingId = data;
      }
    } catch (e) {
      bookingId = data;
    }

    if (!bookingId || bookingId.length < 10) {
      CustomAlert.alert('Erreur', 'QR code invalide.', [
        { text: 'OK', onPress: () => setScanned(false) }
      ]);
      return;
    }

    // Trouver si le passager fait partie de ce trajet
    const booking = bookings.find((b: any) => b.id === bookingId);
    if (!booking) {
      CustomAlert.alert('Erreur', "Ce ticket ne correspond à aucune réservation confirmée sur ce trajet.", [
        { text: 'OK', onPress: () => setScanned(false) }
      ]);
      return;
    }

    if (booking.status === 'started') {
      CustomAlert.alert('Info', "Ce passager a déjà été marqué comme embarqué.", [
        { text: 'OK', onPress: () => {
          setShowScanner(false);
          setScanned(false);
        }}
      ]);
      return;
    }

    CustomAlert.alert(
      'Validation d\'embarquement',
      `Voulez-vous valider l'embarquement de ${passengerName} ?`,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => setScanned(false) },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await authFetch(`/bookings/${bookingId}/board/`, {
                method: 'POST'
              });
              CustomAlert.alert('Succès', 'Embarquement validé avec succès !');
              setShowScanner(false);
              await onRefresh();
            } catch (err: any) {
              CustomAlert.alert('Erreur', err.message || "Erreur lors de la validation.");
            } finally {
              setScanned(false);
            }
          }
        }
      ]
    );
  };

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
          <RideTimeline ride={ride} bookings={bookings} />

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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Passagers ({activeBookings.length})</Text>
          {activeBookings.some((b: any) => b.status === 'confirmed') && (
            <TouchableOpacity 
              style={styles.scanHeaderBtn} 
              onPress={async () => {
                if (!cameraPermission || !cameraPermission.granted) {
                  const res = await requestCameraPermission();
                  if (!res || !res.granted) {
                    CustomAlert.alert('Permission requise', "L'accès à l'appareil photo est nécessaire pour scanner.");
                    return;
                  }
                }
                setScanned(false);
                setShowScanner(true);
              }}
            >
              <Ionicons name="qr-code-outline" size={16} color={COLORS.white} />
              <Text style={styles.scanHeaderBtnText}>Scanner QR</Text>
            </TouchableOpacity>
          )}
        </View>
        
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
              onBoard={() => {
                setSelectedBookingForManualCode(booking);
                setShowCodeInputModal(true);
              }}
              onDownloadManifest={handleDownloadManifest}
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

          { (ride.music !== undefined || ride.driver_details?.preference) ? (
            <View style={styles.preferencesSection}>
              <Text style={styles.subSectionTitle}>Préférences de voyage</Text>
              <View style={styles.prefTagsContainer}>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>
                    { (ride.music ?? ride.driver_details?.preference?.music) ? "Musique autorisée" : "Pas de musique" }
                  </Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>
                    { (ride.smoking ?? ride.driver_details?.preference?.smoking) ? "Fumeur" : "Non-fumeur" }
                  </Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>
                    { (ride.chatty ?? ride.driver_details?.preference?.chatty) ? "Discussion" : "Calme" }
                  </Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>
                    { (ride.air_conditioner ?? ride.driver_details?.preference?.air_conditioner) ? "Climatisation" : "Pas de clim" }
                  </Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>
                    { (ride.pets_allowed ?? ride.driver_details?.preference?.pets_allowed) ? "Animaux admis" : "Sans animaux" }
                  </Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>
                    { (ride.luggage_allowed ?? ride.driver_details?.preference?.luggage_allowed) ? "Bagages admis" : "Bagages limités" }
                  </Text>
                </View>
                <View style={styles.prefTagItem}>
                  <Text style={styles.prefTagText}>
                    { (ride.stops_allowed ?? ride.driver_details?.preference?.stops_allowed) ? "Arrêts possibles" : "Direct (sans arrêts)" }
                  </Text>
                </View>
              </View>
              { (ride.description || ride.driver_details?.preference?.notes) ? (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes complémentaires :</Text>
                  <Text style={styles.notesText}>
                    "{ride.description || ride.driver_details?.preference?.notes}"
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noVehicleText}>Aucune préférence enregistrée pour ce trajet.</Text>
          )}
        </View>

        {/* Main Actions - Masqués pour le moment
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
        */}
        
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

      {/* Scanner Modal */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.scannerCloseBtn}>
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scanner le ticket QR</Text>
          </View>
          
          <View style={styles.cameraContainer}>
            {!cameraPermission ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : !cameraPermission.granted ? (
              <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>L'application a besoin de l'accès à votre appareil photo pour scanner les billets.</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
                  <Text style={styles.permissionBtnText}>Autoriser la caméra</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
              />
            )}
            {cameraPermission?.granted && (
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerTarget} />
                <Text style={styles.scannerHelpText}>Cadrez le QR Code à l'intérieur du carré</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Manual Code Validation Modal */}
      <Modal visible={showCodeInputModal} transparent animationType="fade" onRequestClose={() => {
        setShowCodeInputModal(false);
        setManualCode('');
        setSelectedBookingForManualCode(null);
      }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Saisir le code du ticket</Text>
            <Text style={styles.modalSubtitle}>
              Saisissez le code de ticket du passager {selectedBookingForManualCode?.passenger_details?.full_name} (ex: T-XXXXXXXX ou l'ID complet).
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Code (ex: T-A1B2C3D4)"
              placeholderTextColor={COLORS.textLight}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => {
                setShowCodeInputModal(false);
                setManualCode('');
                setSelectedBookingForManualCode(null);
              }}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, !manualCode.trim() && { backgroundColor: COLORS.border }]} 
                disabled={!manualCode.trim()}
                onPress={() => {
                  if (selectedBookingForManualCode) {
                    handleBoardWithCode(selectedBookingForManualCode.id);
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>Valider</Text>
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

  // Boarding and Scanning styles
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    paddingRight: 4
  },
  scanHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6
  },
  scanHeaderBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700'
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000'
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.8)'
  },
  scannerCloseBtn: {
    padding: 4
  },
  scannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 16
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  permissionContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 16
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22
  },
  permissionBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  scannerTarget: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderRadius: 16
  },
  scannerHelpText: {
    color: '#FFFFFF',
    marginTop: 24,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    gap: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '600'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white
  }
});
