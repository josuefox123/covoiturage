/**
 * ==============================================================
 * Fichier :
 * book-parcel.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../src/context/AuthContext';
import { Ride } from '../../src/types';
import { CustomAlert } from '../../src/utils/CustomAlert';

const COLORS = {
  primary: '#10B981', // green for parcels
  success: '#16A34A',
  error: '#DC2626',
  white: '#FFFFFF',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  grayLight: '#F3F4F6',
  primaryLight: '#D1FAE5',
};

/**
 * Composant BookParcelScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à BookParcelScreen.
 */
export default function BookParcelScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const router = useRouter();
  const { authFetch, user } = useAuth();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [financialSettings, setFinancialSettings] = useState<any>(null);

  const [senderName, setSenderName] = useState(user?.full_name || '');
  const [senderPhone, setSenderPhone] = useState(user?.phone || '');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');

  useEffect(() => {
    const fetchRide = async () => {
      try {
        const [rideData, settingsData] = await Promise.all([
          authFetch(`/rides/${rideId}/`),
          authFetch('/financial-settings/')
        ]);
        setRide(rideData);
        if (settingsData && settingsData.length > 0) {
          setFinancialSettings(settingsData[0]);
        }
        if (rideData.allowed_parcel_types && rideData.allowed_parcel_types.length > 0) {
          setSelectedType(rideData.allowed_parcel_types[0]);
        }
      } catch (e) {
        console.error('Error fetching data:', e);
        CustomAlert.alert('Erreur', 'Impossible de charger les informations.');
      } finally {
        setLoading(false);
      }
    };
    fetchRide();
  }, [rideId]);

  const handleBooking = async () => {
    if (!user?.is_verified) {
      CustomAlert.alert('Compte non vérifié', 'Votre compte doit être vérifié pour envoyer un colis.');
      return;
    }
    if (!receiverName || !receiverPhone || !description) {
      CustomAlert.alert('Erreur', 'Veuillez remplir les informations du destinataire et la description du colis.');
      return;
    }

    CustomAlert.alert(
      'Frais de service Zemy',
      `Vous allez payer ${ride?.price_per_parcel} FCFA en ligne. Ce montant sera transféré au conducteur une fois le colis livré.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'J\'accepte et je paie', onPress: performBooking }
      ]
    );
  };

  const performBooking = async () => {
    let currentParcelId: string | null = null;
    try {
      setBookingLoading(true);

      // 1. Create Parcel (Pending)
      const res = await authFetch('/parcels/', {
        method: 'POST',
        body: JSON.stringify({
          ride: rideId,
          receiver_name: receiverName,
          receiver_phone: receiverPhone,
          description: description,
          parcel_type: selectedType,
          dimensions: ride?.max_dimensions,
          weight_kg: ride?.max_weight_per_parcel
        })
      });
      currentParcelId = res.id;

      // 2. Initialiser le paiement
      const payRes = await authFetch(`/parcels/${currentParcelId}/pay/`, {
        method: 'POST'
      });

      if (payRes.url) {
        // 3. Ouvrir le navigateur FedaPay
        await WebBrowser.openBrowserAsync(payRes.url);

        CustomAlert.alert(
          'Vérification du paiement',
          'Veuillez patienter pendant que nous validons votre transaction...',
          []
        );

        await authFetch(`/parcels/${currentParcelId}/verify-payment/`, {
          method: 'POST',
          body: JSON.stringify({ transaction_id: payRes.transaction_id })
        });

        CustomAlert.alert(
          'Colis enregistré ! 🎉',
          `Votre envoi a été validé. Veuillez remettre le colis au conducteur à l'heure convenue. Le QR Code vous sera fourni dans vos envois.`,
          [
            { text: 'Voir mes envois', onPress: () => { router.replace('/(tabs)/trips'); } }
          ]
        );
      }
    } catch (error: any) {
      if (currentParcelId) {
        try {
          // If error occurs before payment confirmation, backend might leave it pending or delete it.
          // Ideally we would delete the pending parcel.
        } catch (e) { }
      }
      CustomAlert.alert('Erreur', error.message || "Le paiement n'a pas été finalisé.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading || !ride) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  const driverPrice = ride?.price_per_parcel || 0;
  const commRate = financialSettings?.parcel_commission_percentage || 8;
  const commMin = financialSettings?.min_parcel_commission || 100;
  const zemyCommission = Math.max(commMin, Math.floor(driverPrice * (commRate / 100)));
  const totalPrice = driverPrice + zemyCommission;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Envoyer un Colis</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Trajet : {ride.departure_location} ➔ {ride.arrival_location}</Text>
          <Text style={styles.infoText}>Prix conducteur : <Text style={styles.boldText}>{driverPrice} FCFA</Text></Text>
          <Text style={styles.infoText}>Frais de service : <Text style={styles.boldText}>{zemyCommission} FCFA</Text></Text>
          <Text style={[styles.infoText, { marginTop: 4, color: COLORS.primary }]}>Total à payer : <Text style={styles.boldText}>{totalPrice} FCFA</Text></Text>
          <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 8 }} />
          <Text style={styles.infoText}>Poids maximum : <Text style={styles.boldText}>{ride.max_weight_per_parcel} kg</Text></Text>
          <Text style={styles.infoText}>Dimensions max : <Text style={styles.boldText}>{ride.max_dimensions}</Text></Text>
        </View>

        <Text style={styles.label}>Type de Colis</Text>
        <View style={styles.typesContainer}>
          {ride.allowed_parcel_types?.map((type: string) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeBadge, selectedType === type && styles.typeBadgeActive]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={[styles.typeText, selectedType === type && styles.typeTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Description du colis</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Ex: Ordinateur portable dans une sacoche noire"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Nom du Destinataire</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Jean Dupont"
          value={receiverName}
          onChangeText={setReceiverName}
        />

        <Text style={styles.label}>Numéro de Téléphone du Destinataire</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 0022997000000"
          keyboardType="phone-pad"
          value={receiverPhone}
          onChangeText={setReceiverPhone}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={handleBooking}
          disabled={bookingLoading}
        >
          {bookingLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="card-outline" size={20} color={COLORS.white} />
              <Text style={styles.bookBtnText}>Payer {totalPrice} FCFA</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  scrollContent: { padding: 16, paddingBottom: 100 },
  infoCard: { backgroundColor: COLORS.primaryLight, padding: 16, borderRadius: 12, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 8 },
  infoText: { fontSize: 14, color: COLORS.text, marginBottom: 4 },
  boldText: { fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: COLORS.border, fontSize: 15 },
  textArea: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 16, paddingTop: 12, minHeight: 80, borderWidth: 1, borderColor: COLORS.border, fontSize: 15, textAlignVertical: 'top' },
  typesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBadge: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  typeBadgeActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  typeTextActive: { color: COLORS.white },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 10 },
  bookBtn: { height: 56, backgroundColor: COLORS.primary, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  bookBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
