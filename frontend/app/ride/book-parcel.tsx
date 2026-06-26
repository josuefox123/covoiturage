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
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);



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

    const driverPrice = ride?.price_per_parcel || 0;
    const commRate = financialSettings?.parcel_commission_percentage || 8;
    const commMin = financialSettings?.min_parcel_commission || 100;
    const zemyCommission = Math.max(commMin, Math.floor(driverPrice * (commRate / 100)));

    CustomAlert.alert(
      'Conditions et règles de remboursement',
      `Pour réserver la place pour votre colis, vous allez payer uniquement les frais de service de ${zemyCommission} FCFA en ligne. Le montant du transport (${driverPrice} FCFA) sera à régler directement au conducteur.\n\nRègles de remboursement :\n• Annulation par le conducteur : Remboursement intégral (100%).\n• Annulation par vous à plus de 5h du départ (si montant ≥ 1 000 FCFA) : Éligible à un remboursement (soumis à validation).\n• Annulation par vous à moins de 5h du départ ou montant < 1 000 FCFA : Aucun remboursement possible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'J\'accepte et je paie', onPress: performBooking }
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    const { status } = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', `Vous devez autoriser l'accès à ${source === 'camera' ? 'la caméra' : 'vos photos'}.`);
      return;
    }
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.3 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5, mediaTypes: ['images'] });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      CustomAlert.alert('Erreur', 'Impossible de charger l\'image.');
    }
  };

  const performBooking = async () => {
    let currentParcelId: string | null = null;
    const driverPrice = ride?.price_per_parcel || 0;
    try {
      setBookingLoading(true);

      // 1. Create Parcel (Pending)
      let body: any;
      const payload: any = {
        ride: rideId,
        sender_name: senderName || user?.full_name || 'Expéditeur',
        sender_phone: senderPhone || user?.phone || 'Non renseigné',
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        pickup_location: ride?.departure_location || 'Lieu de départ',
        dropoff_location: ride?.arrival_location || 'Lieu d\'arrivée',
        description: description,
        weight: ride?.max_weight_per_parcel || 1,
        dimensions: ride?.max_dimensions || 'Moyen',
        price: driverPrice + Math.max(
          financialSettings?.min_parcel_commission || 100,
          Math.floor((ride?.price_per_parcel || 0) * ((financialSettings?.parcel_commission_percentage || 8) / 100))
        ),
      };

      if (photoUri) {
        body = new FormData();
        Object.keys(payload).forEach(key => {
          body.append(key, payload[key].toString());
        });

        const filename = photoUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        body.append('photo', {
          uri: photoUri,
          name: filename,
          type
        } as any);
      } else {
        body = JSON.stringify(payload);
      }

      const res = await authFetch('/parcels/', {
        method: 'POST',
        body: body
      });
      currentParcelId = res.id;

      // 2. Initialiser le paiement avec FedaPay
      const callbackUrl = ExpoLinking.createURL(`ride/book-parcel`, {
        queryParams: { rideId, action: 'payment_complete', parcel_id: String(currentParcelId) }
      });
      const payRes = await authFetch(`/parcels/${currentParcelId}/pay/`, {
        method: 'POST',
        body: JSON.stringify({ callback_url: callbackUrl })
      });

      if (payRes.url) {
        // Rediriger vers l'écran de paiement
        router.push({
          pathname: '/payment-redirect',
          params: {
            checkoutUrl: payRes.url,
            parcelId: String(currentParcelId),
          }
        });
      }
    } catch (error: any) {
      if (currentParcelId) {
        // On ne supprime PAS le colis si un paiement a peut-être été initié
        CustomAlert.alert(
          'Paiement initié',
          'Votre colis a été enregistré. Si vous avez payé, vérifiez le statut dans "Mes envois".',
          [
            { text: 'Voir mes envois', onPress: () => { router.replace('/(tabs)/trips'); } },
            { text: 'Fermer', style: 'cancel' }
          ]
        );
      } else {
        CustomAlert.alert('Erreur', error.message || "Impossible de créer l'envoi. Veuillez réessayer.");
      }
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Trajet : {ride.departure_location} ➔ {ride.arrival_location}</Text>
            <Text style={styles.infoText}>Prix estimé du transport : <Text style={styles.boldText}>{driverPrice} FCFA</Text> (à régler au cond.)</Text>
            <Text style={styles.infoText}>Frais de réservation (en ligne) : <Text style={styles.boldText}>{zemyCommission} FCFA</Text></Text>
            <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 8 }} />
            <Text style={[styles.infoText, { marginTop: 4, color: COLORS.primary }]}>Coût total estimé : <Text style={styles.boldText}>{totalPrice} FCFA</Text></Text>
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

          <Text style={styles.label}>Photo du Colis (Optionnel)</Text>
          {photoUri ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setPhotoUri(null)}>
                <Ionicons name="close-circle" size={28} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoBtnRow}>
              <TouchableOpacity style={styles.photoBtnAction} onPress={() => pickImage('camera')}>
                <Ionicons name="camera" size={20} color={COLORS.primary} />
                <Text style={styles.photoBtnActionText}>Caméra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtnAction} onPress={() => pickImage('gallery')}>
                <Ionicons name="images" size={20} color={COLORS.primary} />
                <Text style={styles.photoBtnActionText}>Galerie</Text>
              </TouchableOpacity>
            </View>
          )}

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
                <Text style={styles.bookBtnText}>Payer la réservation ({zemyCommission} FCFA)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>



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
  photoBtnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  photoBtnAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', borderStyle: 'dashed', gap: 8 },
  photoBtnActionText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  photoContainer: { position: 'relative', width: 120, height: 120, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  photoPreview: { width: '100%', height: '100%', borderRadius: 12 },
  photoRemoveBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.white, borderRadius: 14 },
});
