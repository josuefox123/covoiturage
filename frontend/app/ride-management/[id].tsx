/**
 * ============================================================
 * Zemy — Ride Management Screen (Premium Redesign 2026)
 * Refactorisé : composants déplacés dans src/features/ride-management/composants/
 * ============================================================
 */
import React, { useRef, useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Animated, RefreshControl, Modal, TextInput, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { CustomAlert } from '../../src/utils/CustomAlert';
import { useCameraPermissions } from 'expo-camera';
import { API_URL } from '@/src/services/api';
import { useRideManagement } from '@/src/features/ride-management/hooks/useRideManagement';

// ─── Composants Extraits ─────────────────────────────────────────────────────
import { C, SHsm, SHmd, SHlg } from '@/src/features/ride-management/composants/theme-gestion';
import { EcranChargement } from '@/src/features/ride-management/composants/AnimationsGestion';
import { HeroCard } from '@/src/features/ride-management/composants/HeroCard';
import { StatsGrid } from '@/src/features/ride-management/composants/StatsGrid';
import { Timeline } from '@/src/features/ride-management/composants/Timeline';
import { PendingBookingCard } from '@/src/features/ride-management/composants/PendingBookingCard';
import { PassengerCard } from '@/src/features/ride-management/composants/PassengerCard';
import { VehicleCard } from '@/src/features/ride-management/composants/VehicleCard';
import { PremiumScanner } from '@/src/features/ride-management/composants/PremiumScanner';

export default function RideManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, authFetch } = useAuth();

  const {
    ride, bookings, loading, refreshing,
    editingBooking, customPriceText,
    setEditingBooking, setCustomPriceText,
    onRefresh, handleAcceptBooking, handleRejectBooking,
    handleChatWithPassenger,
  } = useRideManagement(id as string, authFetch, user);

  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedBookingForCode, setSelectedBookingForCode] = useState<any>(null);
  const [downloadingManifestId, setDownloadingManifestId] = useState<string | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Cache le FAB au scroll
  const fabTranslate = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 120],
    extrapolate: 'clamp'
  });

  const handleBoardWithCode = async (bookingId: string) => {
    if (!selectedBookingForCode) return;
    const cleanCode = manualCode.trim().replace('T-', '').toUpperCase();
    const expectedPrefix = selectedBookingForCode.id.substring(0, 8).toUpperCase();
    const fullIdMatch = manualCode.trim() === selectedBookingForCode.id;

    if (cleanCode !== expectedPrefix && !fullIdMatch) {
      CustomAlert.alert('Code incorrect', 'Le code saisi ne correspond pas à ce passager.');
      return;
    }
    try {
      await authFetch(`/bookings/${bookingId}/board/`, { method: 'POST' });
      CustomAlert.alert('Succès', 'Embarquement validé !');
      setShowCodeModal(false);
      setManualCode('');
      setSelectedBookingForCode(null);
      await onRefresh();
    } catch (err: any) {
      CustomAlert.alert('Erreur', err.message || "Impossible de valider l'embarquement.");
    }
  };

  const handleDownloadManifest = async (bookingId: string) => {
    try {
      setDownloadingManifestId(bookingId);
      const FileSystem = require('expo-file-system/legacy');
      const Sharing = require('expo-sharing');
      const SecureStore = require('expo-secure-store');

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        CustomAlert.alert('Non disponible', "Le partage n'est pas disponible.");
        return;
      }
      const storedToken = await SecureStore.getItemAsync('zemy_access_token');
      const manifestUrl = `${API_URL}/bookings/${bookingId}/manifest/`;
      const localUri = (FileSystem.documentDirectory ?? '') + `reservation_${bookingId.substring(0, 8)}.pdf`;

      const result = await FileSystem.downloadAsync(manifestUrl, localUri, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {}
      });

      if (result.status === 200) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Reconnaissance de réservation Zemy',
          UTI: 'com.adobe.pdf'
        });
      } else {
        CustomAlert.alert('Erreur', 'Impossible de télécharger le document.');
      }
    } catch {
      CustomAlert.alert('Erreur', 'Impossible de générer la reconnaissance.');
    } finally {
      setDownloadingManifestId(null);
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    let bookingId = '';
    let passengerName = 'le passager';
    try {
      const parsed = JSON.parse(data);
      bookingId = parsed.booking || data;
      passengerName = parsed.passenger || 'le passager';
    } catch {
      bookingId = data;
    }

    if (!bookingId || bookingId.length < 10) {
      CustomAlert.alert('Erreur', 'QR code invalide.', [{ text: 'OK', onPress: () => setScanned(false) }]);
      return;
    }
    const booking = bookings.find((b: any) => b.id === bookingId);
    if (!booking) {
      CustomAlert.alert('Erreur', 'Ce ticket ne correspond à aucune réservation.', [{ text: 'OK', onPress: () => setScanned(false) }]);
      return;
    }
    if (booking.status === 'started') {
      CustomAlert.alert('Info', 'Ce passager a déjà embarqué.', [
        { text: 'OK', onPress: () => { setShowScanner(false); setScanned(false); } }
      ]);
      return;
    }

    CustomAlert.alert('Validation', `Valider l'embarquement de ${passengerName} ?`, [
      { text: 'Annuler', style: 'cancel', onPress: () => setScanned(false) },
      {
        text: 'Confirmer',
        onPress: async () => {
          try {
            await authFetch(`/bookings/${bookingId}/board/`, { method: 'POST' });
            CustomAlert.alert('Succès', 'Embarquement validé !');
            setShowScanner(false);
            await onRefresh();
          } catch (err: any) {
            CustomAlert.alert('Erreur', err.message || 'Erreur lors de la validation.');
          } finally {
            setScanned(false);
          }
        }
      },
    ]);
  };

  const handleContactPassengers = () => {
    const active = bookings.filter((b: any) =>
      ['paid', 'escrow'].includes(b.payment_status) && ['confirmed', 'active', 'completed', 'started'].includes(b.status)
    );
    if (active.length === 0) return;
    if (active.length === 1) {
      const pId = active[0].passenger_details?.id;
      if (pId) handleChatWithPassenger(pId);
      return;
    }
    const opts = active.map((b: any) => ({
      text: b.passenger_details?.full_name || 'Passager',
      onPress: () => {
        const pId = b.passenger_details?.id;
        if (pId) handleChatWithPassenger(pId);
      }
    }));
    opts.push({ text: 'Annuler', style: 'cancel' } as any);
    CustomAlert.alert('Contacter un passager', 'Choisissez le passager :', opts);
  };

  if (loading) return <EcranChargement />;
  if (!ride) return null;

  const pendingRequests = bookings.filter((b: any) =>
    ['pending', 'pending_driver', 'pending_passenger', 'pending_payment', 'payment_processing'].includes(b.status)
  );
  const activeBookings = bookings.filter((b: any) =>
    ['confirmed', 'active', 'started', 'completed'].includes(b.status)
  );
  const cancelledBookings = bookings.filter((b: any) =>
    ['cancelled', 'rejected', 'payment_failed', 'expired'].includes(b.status)
  );
  const totalRevenue = bookings
    .filter((b: any) => b.payment_status !== 'pending' && ['confirmed', 'active', 'started', 'completed'].includes(b.status))
    .reduce((sum: number, b: any) => sum + ((ride.price_per_seat || 0) * (b.seats_booked || 1)), 0);
  const seatsBooked = ride.total_seats - ride.seats_available;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {/* En-tête */}
      <View style={[styles.hdr, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.hdrBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.hdrCenter}>
          <Text style={styles.hdrTitle}>Gestion du trajet</Text>
          <Text style={styles.hdrSub}>
            {new Date(ride.departure_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} • {ride.departure_time?.substring(0, 5)}
          </Text>
        </View>
        <TouchableOpacity style={styles.hdrMenuBtn} onPress={() => CustomAlert.alert('Menu', 'Options à venir.')} activeOpacity={0.8}>
          <Ionicons name="ellipsis-vertical" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      {/* Contenu Défilant */}
      <Animated.ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        <HeroCard ride={ride} />

        <StatsGrid ride={ride} totalRevenue={totalRevenue} seatsBooked={seatsBooked} />

        <Timeline ride={ride} />

        {/* Demandes en attente */}
        {pendingRequests.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: C.warning }]} />
              <Text style={[styles.sectionTitle, { color: C.warning }]}>Demandes ({pendingRequests.length})</Text>
            </View>
            {pendingRequests.map((booking: any) => (
              <PendingBookingCard
                key={booking.id}
                booking={booking}
                ridePrice={ride.price_per_seat}
                onAccept={() => {
                  setEditingBooking(booking);
                  const ip = booking.portion_price ? Math.round(booking.portion_price / booking.seats_booked) : (ride?.price_per_seat || 0);
                  setCustomPriceText(String(ip));
                }}
                onReject={() => handleRejectBooking(booking.id)}
              />
            ))}
          </>
        )}

        {/* Passagers actifs */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: C.success }]} />
            <Text style={styles.sectionTitle}>Passagers ({activeBookings.length})</Text>
          </View>
          {activeBookings.some((b: any) => b.status === 'confirmed') && (
            <TouchableOpacity
              style={styles.qrScanBtn}
              onPress={async () => {
                if (!cameraPermission || !cameraPermission.granted) {
                  const res = await requestCameraPermission();
                  if (!res?.granted) {
                    CustomAlert.alert('Permission requise', "L'accès à la caméra est nécessaire.");
                    return;
                  }
                }
                setScanned(false);
                setShowScanner(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code" size={14} color={C.white} />
              <Text style={styles.qrScanBtnTxt}>Scanner QR</Text>
            </TouchableOpacity>
          )}
        </View>

        {activeBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={40} color={C.textLight} />
            <Text style={styles.emptyTxt}>Aucun passager confirmé pour l'instant</Text>
          </View>
        ) : (
          activeBookings.map((booking: any) => (
            <PassengerCard
              key={booking.id}
              booking={booking}
              onMessage={handleChatWithPassenger}
              onCall={(ph?: string) => {
                if (!ph) {
                  CustomAlert.alert('Erreur', 'Numéro indisponible.');
                  return;
                }
                Linking.openURL(`tel:${ph}`);
              }}
              onBoard={() => {
                setSelectedBookingForCode(booking);
                setShowCodeModal(true);
              }}
              onDownloadManifest={handleDownloadManifest}
              downloadingManifestId={downloadingManifestId}
            />
          ))
        )}

        {/* Réservations annulées */}
        {cancelledBookings.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: C.textLight }]} />
              <Text style={[styles.sectionTitle, { color: C.textSec }]}>Annulées ({cancelledBookings.length})</Text>
            </View>
            {cancelledBookings.map((booking: any) => (
              <PassengerCard
                key={booking.id}
                booking={booking}
                onMessage={handleChatWithPassenger}
                onCall={(ph?: string) => { if (ph) Linking.openURL(`tel:${ph}`); }}
              />
            ))}
          </>
        )}

        <VehicleCard ride={ride} />
      </Animated.ScrollView>

      {/* Bouton de messagerie collective (FAB) */}
      {activeBookings.length > 0 && (
        <Animated.View style={[styles.fabWrap, { bottom: Math.max(24, insets.bottom + 12), transform: [{ translateY: fabTranslate }] }]}>
          <TouchableOpacity style={styles.fab} onPress={handleContactPassengers} activeOpacity={0.9}>
            <Ionicons name="chatbubbles" size={20} color={C.white} />
            <Text style={styles.fabTxt}>Contacter les passagers</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Modal Ajuster Tarif */}
      <Modal visible={editingBooking !== null} transparent animationType="slide" onRequestClose={() => setEditingBooking(null)}>
        <View style={styles.modalBg}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Ajuster le tarif</Text>
            <Text style={styles.sheetSub}>
              Tarif par place pour {editingBooking?.departure_location?.split(',')[0]} → {editingBooking?.arrival_location?.split(',')[0]}
            </Text>
            <View style={styles.priceInput}>
              <TextInput
                style={styles.priceInputTxt}
                value={customPriceText}
                onChangeText={setCustomPriceText}
                keyboardType="numeric"
                placeholder="Ex: 1500"
                placeholderTextColor={C.textLight}
              />
              <Text style={styles.priceInputCur}>FCFA / place</Text>
            </View>
            <TouchableOpacity
              style={styles.acceptBtnFull}
              onPress={() => {
                const price = parseInt(customPriceText);
                if (isNaN(price) || price <= 0) {
                  CustomAlert.alert('Erreur', 'Prix invalide.');
                  return;
                }
                handleAcceptBooking(editingBooking!.id, price);
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="checkmark-circle" size={19} color={C.white} />
              <Text style={styles.acceptBtnFullTxt}>Accepter avec ce prix</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtnFull} onPress={() => setEditingBooking(null)} activeOpacity={0.8}>
              <Text style={styles.cancelBtnFullTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Code Ticket Manuel */}
      <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => { setShowCodeModal(false); setManualCode(''); setSelectedBookingForCode(null); }}>
        <View style={styles.modalBg}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Code du ticket</Text>
            <Text style={styles.sheetSub}>
              Saisissez le code de {selectedBookingForCode?.passenger_details?.full_name || 'le passager'} (ex: T-XXXXXXXX)
            </Text>
            <TextInput
              style={styles.codeInput}
              placeholder="T-A1B2C3D4"
              placeholderTextColor={C.textLight}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[styles.cancelBtnFull, { flex: 1 }]} onPress={() => { setShowCodeModal(false); setManualCode(''); setSelectedBookingForCode(null); }} activeOpacity={0.8}>
                <Text style={styles.cancelBtnFullTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtnFull, { flex: 1, opacity: !manualCode.trim() ? 0.5 : 1 }]}
                disabled={!manualCode.trim()}
                onPress={() => selectedBookingForCode && handleBoardWithCode(selectedBookingForCode.id)}
                activeOpacity={0.9}
              >
                <Text style={styles.acceptBtnFullTxt}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Scanner QR Code */}
      <PremiumScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        scanned={scanned}
        onScan={handleBarCodeScanned}
        permission={cameraPermission}
        requestPermission={requestCameraPermission}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  hdr: { backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.border, ...SHmd },
  hdrBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  hdrMenuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  hdrCenter: { flex: 1, alignItems: 'center', gap: 2 },
  hdrTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  hdrSub: { fontSize: 12, fontWeight: '500', color: C.textSec },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  qrScanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  qrScanBtnTxt: { fontSize: 12, fontWeight: '700', color: C.white },
  emptyCard: { backgroundColor: C.white, borderRadius: 24, padding: 40, alignItems: 'center', gap: 12, marginBottom: 14, ...SHsm },
  emptyTxt: { fontSize: 14, color: C.textSec, textAlign: 'center' },
  fabWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.primary, paddingVertical: 18, paddingHorizontal: 28, borderRadius: 32, ...SHlg },
  fabTxt: { fontSize: 15, fontWeight: '800', color: C.white },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: C.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 14 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderMid, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  sheetSub: { fontSize: 14, color: C.textSec, lineHeight: 20 },
  priceInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 18, height: 58 },
  priceInputTxt: { flex: 1, fontSize: 22, fontWeight: '800', color: C.text },
  priceInputCur: { fontSize: 14, fontWeight: '700', color: C.textSec },
  codeInput: { borderWidth: 1.5, borderColor: C.borderMid, borderRadius: 16, padding: 16, fontSize: 18, color: C.text, textAlign: 'center', fontWeight: '700', backgroundColor: C.bg },
  acceptBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.success, borderRadius: 18, height: 56, ...SHsm },
  acceptBtnFullTxt: { fontSize: 15, fontWeight: '800', color: C.white },
  cancelBtnFull: { alignItems: 'center', justifyContent: 'center', borderRadius: 18, height: 50, borderWidth: 1.5, borderColor: C.borderMid },
  cancelBtnFullTxt: { fontSize: 14, fontWeight: '600', color: C.textSec }
});
